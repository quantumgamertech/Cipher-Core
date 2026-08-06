import { spawn } from 'node:child_process';
import { statfs } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CipherPulseHardware } from './cipherPulseHardware.js';

const SENSOR_WORKER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'sensor-worker.ps1',
);
const STALE_AFTER_MS = 5_000;

const clamp = (value, min = 0, max = 100) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null;
};

export function normalizeWorkerSample(sample) {
  return {
    cpuUsage: clamp(sample?.cpuUsage),
    cpuTemperature: clamp(sample?.cpuTemperature, 0, 150),
    gpuUsage: clamp(sample?.gpuUsage),
    gpuTemperature: clamp(sample?.gpuTemperature, 0, 150),
    networkBytesPerSecond: Math.max(0, Number(sample?.networkBytesPerSecond) || 0),
    networkUtilization: clamp(sample?.networkUtilization) ?? 0,
    gpuUsageSource: String(sample?.gpuUsageSource || 'unavailable'),
    cpuTemperatureSource: String(sample?.cpuTemperatureSource || 'unavailable'),
    gpuTemperatureSource: String(sample?.gpuTemperatureSource || 'unavailable'),
    sampledAt: sample?.sampledAt || new Date().toISOString(),
  };
}

export function parseWorkerLine(line) {
  const trimmed = String(line).trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    return normalizeWorkerSample(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export async function readDiskUsage(
  root = `${path.parse(process.cwd()).root || 'C:\\'}`,
  statfsReader = statfs,
) {
  const stats = await statfsReader(root);
  const blocks = Number(stats.blocks);
  const available = Number(stats.bavail);
  if (!Number.isFinite(blocks) || blocks <= 0 || !Number.isFinite(available)) return null;
  return clamp(((blocks - available) / blocks) * 100);
}

export class SensorEngine {
  constructor({
    spawnWorker = spawn,
    diskReader = readDiskUsage,
    now = () => Date.now(),
    system = os,
    logger = console,
    hardware = new CipherPulseHardware({ logger }),
  } = {}) {
    this.spawnWorker = spawnWorker;
    this.diskReader = diskReader;
    this.now = now;
    this.system = system;
    this.logger = logger;
    this.hardware = hardware;
    this.startedAt = now();
    this.worker = null;
    this.workerBuffer = '';
    this.latestWorkerSample = null;
    this.workerError = null;
  }

  start() {
    if (this.worker || process.platform !== 'win32') return;

    this.worker = this.spawnWorker(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        SENSOR_WORKER,
      ],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    this.worker.stdout?.setEncoding('utf8');
    this.worker.stdout?.on('data', (chunk) => this.consumeWorkerOutput(chunk));
    this.worker.stderr?.setEncoding('utf8');
    this.worker.stderr?.on('data', (chunk) => {
      const message = String(chunk).trim();
      if (message) this.logger.warn(`[CipherVision] worker warning: ${message}`);
    });
    this.worker.once('error', (error) => {
      this.workerError = error.message;
      this.logger.error(`[CipherVision] worker error: ${error.message}`);
    });
    this.worker.once('exit', (code) => {
      if (code !== 0 && code !== null) {
        this.workerError = `Sensor worker exited with code ${code}.`;
      }
      this.worker = null;
    });
    this.hardware.start();
  }

  stop() {
    this.worker?.kill();
    this.worker = null;
    this.hardware.stop();
  }

  consumeWorkerOutput(chunk) {
    this.workerBuffer += String(chunk);
    const lines = this.workerBuffer.split(/\r?\n/);
    this.workerBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const sample = parseWorkerLine(line);
      if (sample) {
        this.latestWorkerSample = sample;
        this.workerError = null;
      }
    }
  }

  async snapshot() {
    const totalMemory = this.system.totalmem();
    const freeMemory = this.system.freemem();
    const memoryUsage = totalMemory > 0
      ? clamp(((totalMemory - freeMemory) / totalMemory) * 100)
      : null;

    let diskUsage = null;
    try {
      diskUsage = await this.diskReader();
    } catch (error) {
      this.logger.warn(`[CipherVision] disk sample unavailable: ${error.message}`);
    }

    const workerSample = this.latestWorkerSample;
    const workerAgeMs = workerSample
      ? this.now() - Date.parse(workerSample.sampledAt)
      : Number.POSITIVE_INFINITY;
    const live = workerAgeMs <= STALE_AFTER_MS;
    const hardwareSample = await this.hardware.sample();

    return {
      cpuUsage: live ? workerSample.cpuUsage : null,
      cpuTemp: hardwareSample?.cpuTemperature ?? null,
      gpuUsage: live ? workerSample.gpuUsage : null,
      gpuTemp: live ? workerSample.gpuTemperature : null,
      ram: memoryUsage,
      disk: diskUsage,
      network: live ? workerSample.networkUtilization : 0,
      networkBytesPerSecond: live ? workerSample.networkBytesPerSecond : 0,
      sessionUptimeSeconds: Math.max(0, Math.floor((this.now() - this.startedAt) / 1000)),
      sampledAt: workerSample?.sampledAt ?? new Date(this.now()).toISOString(),
      provider: 'cipher-vision',
      status: live ? 'live' : 'degraded',
      error: live ? null : this.workerError ?? 'Native sensor worker is starting.',
      sources: {
        cpuUsage: live ? 'windows-performance-counters' : 'unavailable',
        cpuTemperature: hardwareSample?.source ?? 'unavailable',
        gpuUsage: live ? workerSample.gpuUsageSource : 'unavailable',
        gpuTemperature: live ? workerSample.gpuTemperatureSource : 'unavailable',
        memory: 'node-os',
        disk: diskUsage === null ? 'unavailable' : 'node-statfs',
        network: live ? 'windows-performance-counters' : 'unavailable',
        uptime: 'sensor-engine',
      },
    };
  }
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

export function sensorEngineApi({ engine = new SensorEngine() } = {}) {
  const configure = (server) => {
    engine.start();
    server.httpServer?.once('close', () => engine.stop());
    server.middlewares.use('/api/telemetry', async (request, response) => {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Method not allowed.' });
        return;
      }
      try {
        sendJson(response, 200, await engine.snapshot());
      } catch (error) {
        sendJson(response, 500, {
          error: `Cipher Vision snapshot failed: ${error.message}`,
          provider: 'cipher-vision',
          status: 'error',
        });
      }
    });
  };

  return {
    name: 'cipher-vision-sensor-engine',
    configureServer: configure,
    configurePreviewServer: configure,
  };
}
