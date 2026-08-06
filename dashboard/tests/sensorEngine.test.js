import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeWorkerSample,
  parseWorkerLine,
  readDiskUsage,
  SensorEngine,
} from '../server/sensorEngine.js';
import {
  CipherPulseHardware,
  normalizeHardwareSample,
} from '../server/cipherPulseHardware.js';
import {
  normalizeTelemetry,
  readTelemetry,
} from '../src/services/telemetry/telemetryService.js';
import {
  DEFAULT_TEMPERATURE_THRESHOLD,
  evaluateTemperatureAlert,
  normalizeTemperatureThreshold,
  temperatureAlertState,
} from '../src/services/telemetry/temperatureAlerts.js';

test('worker samples preserve unavailable temperatures and clamp percentages', () => {
  assert.deepEqual(
    normalizeWorkerSample({
      cpuUsage: 140,
      cpuTemperature: null,
      gpuUsage: -4,
      gpuTemperature: 55,
      networkBytesPerSecond: 125000,
      networkUtilization: 150,
      sampledAt: '2026-07-05T05:00:00.000Z',
    }),
    {
      cpuUsage: 100,
      cpuTemperature: null,
      gpuUsage: 0,
      gpuTemperature: 55,
      networkBytesPerSecond: 125000,
      networkUtilization: 100,
      gpuUsageSource: 'unavailable',
      cpuTemperatureSource: 'unavailable',
      gpuTemperatureSource: 'unavailable',
      sampledAt: '2026-07-05T05:00:00.000Z',
    },
  );
});

test('worker parser ignores non-JSON output and accepts a compact sample', () => {
  assert.equal(parseWorkerLine('Windows PowerShell'), null);
  assert.equal(parseWorkerLine('{bad json}'), null);
  assert.equal(parseWorkerLine('{"cpuUsage":42}').cpuUsage, 42);
});

test('hardware helper samples reject zero and preserve valid CPU temperatures', () => {
  const now = Date.parse('2026-07-05T05:00:01.000Z');
  assert.equal(normalizeHardwareSample({
    status: 'live',
    cpuTemperature: 0,
    sampledAt: '2026-07-05T05:00:00.000Z',
  }, now), null);
  assert.deepEqual(normalizeHardwareSample({
    status: 'live',
    cpuTemperature: 58.3,
    sampledAt: '2026-07-05T05:00:00.000Z',
    source: 'librehardwaremonitor',
    sensor: 'Core (Tctl/Tdie)',
  }, now), {
    cpuTemperature: 58.3,
    sampledAt: '2026-07-05T05:00:00.000Z',
    source: 'librehardwaremonitor',
    sensor: 'Core (Tctl/Tdie)',
  });
});

test('hardware elevation is unavailable until the normal helper requests it', async () => {
  const calls = [];
  const hardware = new CipherPulseHardware({
    runProcess: async (...args) => calls.push(args),
    logger: { info: () => {}, warn: () => {} },
  });

  assert.equal(await hardware.enableElevatedAccess(), false);
  assert.equal(calls.length, 0);

  hardware.normalResult = 'elevation-required';
  assert.equal(await hardware.enableElevatedAccess(), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'powershell.exe');
  assert.ok(calls[0][1].includes('-Command'));
  assert.equal(hardware.elevationRequested, true);
});

test('disk usage derives used percentage from native statfs data', async () => {
  const usage = await readDiskUsage('C:\\', async () => ({
    blocks: 1000,
    bavail: 250,
  }));
  assert.equal(usage, 75);
});

test('Sensor Engine combines cached counters with native system metrics', async () => {
  let currentTime = Date.parse('2026-07-05T05:00:01.000Z');
  const engine = new SensorEngine({
    diskReader: async () => 61,
    now: () => currentTime,
    system: {
      totalmem: () => 1000,
      freemem: () => 400,
    },
    logger: { warn: () => {}, error: () => {} },
    hardware: {
      sample: async () => null,
      start: () => {},
      stop: () => {},
    },
  });
  engine.startedAt = currentTime - 10_000;
  engine.latestWorkerSample = normalizeWorkerSample({
    cpuUsage: 25,
    cpuTemperature: null,
    gpuUsage: 40,
    gpuTemperature: 55,
    networkBytesPerSecond: 1_250_000,
    networkUtilization: 10,
    gpuUsageSource: 'windows-performance-counters',
    cpuTemperatureSource: 'unavailable',
    gpuTemperatureSource: 'nvidia-smi',
    sampledAt: '2026-07-05T05:00:00.000Z',
  });

  const snapshot = await engine.snapshot();
  assert.equal(snapshot.status, 'live');
  assert.equal(snapshot.cpuUsage, 25);
  assert.equal(snapshot.cpuTemp, null);
  assert.equal(snapshot.gpuUsage, 40);
  assert.equal(snapshot.gpuTemp, 55);
  assert.equal(snapshot.ram, 60);
  assert.equal(snapshot.disk, 61);
  assert.equal(snapshot.networkBytesPerSecond, 1_250_000);
  assert.equal(snapshot.sessionUptimeSeconds, 10);
  assert.equal(snapshot.provider, 'cipher-vision');

  currentTime += 6_000;
  const stale = await engine.snapshot();
  assert.equal(stale.status, 'degraded');
  assert.equal(stale.cpuUsage, null);
  assert.equal(stale.gpuTemp, null);
});

test('Sensor Engine uses validated helper CPU temperature without changing other metrics', async () => {
  const currentTime = Date.parse('2026-07-05T05:00:01.000Z');
  const engine = new SensorEngine({
    diskReader: async () => 61,
    now: () => currentTime,
    system: {
      totalmem: () => 1000,
      freemem: () => 400,
    },
    logger: { warn: () => {}, error: () => {} },
    hardware: {
      sample: async () => ({
        cpuTemperature: 58.3,
        source: 'librehardwaremonitor',
      }),
      start: () => {},
      stop: () => {},
    },
  });
  engine.latestWorkerSample = normalizeWorkerSample({
    cpuUsage: 25,
    cpuTemperature: null,
    gpuUsage: 40,
    gpuTemperature: 55,
    sampledAt: '2026-07-05T05:00:00.000Z',
  });

  const snapshot = await engine.snapshot();
  assert.equal(snapshot.cpuTemp, 58.3);
  assert.equal(snapshot.sources.cpuTemperature, 'librehardwaremonitor');
  assert.equal(snapshot.cpuUsage, 25);
  assert.equal(snapshot.gpuTemp, 55);
  assert.equal(snapshot.ram, 60);
  assert.equal(snapshot.disk, 61);
});

test('frontend telemetry normalization never invents missing temperatures', () => {
  const telemetry = normalizeTelemetry({
    cpuUsage: 101,
    cpuTemp: null,
    gpuUsage: 17,
    gpuTemp: 52,
    ram: 45,
    disk: 60,
    network: 2,
    networkBytesPerSecond: 250000,
    sessionUptimeSeconds: 12.9,
  });

  assert.equal(telemetry.cpuUsage, 100);
  assert.equal(telemetry.cpuTemp, null);
  assert.equal(telemetry.gpuTemp, 52);
  assert.equal(telemetry.sessionUptimeSeconds, 12);
  assert.equal(telemetry.provider, 'cipher-vision');
});

test('frontend telemetry service reads only the Sensor Engine API', async () => {
  const calls = [];
  const telemetry = await readTelemetry({
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          cpuUsage: 20,
          gpuUsage: 30,
          ram: 40,
          disk: 50,
        }),
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/telemetry');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(telemetry.cpuUsage, 20);
});

test('temperature alerts use only approved thresholds and default to 95 C', () => {
  assert.equal(DEFAULT_TEMPERATURE_THRESHOLD, 95);
  assert.equal(normalizeTemperatureThreshold(85), 85);
  assert.equal(normalizeTemperatureThreshold('100'), 100);
  assert.equal(normalizeTemperatureThreshold(90), 95);
});

test('temperature alerts ignore unavailable values and detect CPU or GPU crossings', () => {
  assert.deepEqual(temperatureAlertState({
    cpuTemp: null,
    gpuTemp: null,
  }, 95), { cpu: false, gpu: false });
  assert.deepEqual(temperatureAlertState({
    cpuTemp: 95,
    gpuTemp: 94.9,
  }, 95), { cpu: true, gpu: false });
  assert.deepEqual(temperatureAlertState({
    cpuTemp: 84,
    gpuTemp: 101,
  }, 100), { cpu: false, gpu: true });
});

test('temperature alerts fire once while hot and rearm after cooling', () => {
  const cold = { cpu: false, gpu: false };
  const crossing = evaluateTemperatureAlert(cold, {
    cpuTemp: 95,
    gpuTemp: 50,
  }, 95);
  assert.equal(crossing.changed, true);
  assert.equal(crossing.warning.sensors[0].name, 'CPU');

  const stillHot = evaluateTemperatureAlert(crossing.current, {
    cpuTemp: 99,
    gpuTemp: 50,
  }, 95);
  assert.equal(stillHot.changed, false);

  const cooled = evaluateTemperatureAlert(stillHot.current, {
    cpuTemp: 90,
    gpuTemp: 50,
  }, 95);
  assert.equal(cooled.changed, true);
  assert.equal(cooled.warning, null);

  const secondCrossing = evaluateTemperatureAlert(cooled.current, {
    cpuTemp: 96,
    gpuTemp: 50,
  }, 95);
  assert.equal(secondCrossing.changed, true);
});
