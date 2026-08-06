export const EMPTY_TELEMETRY = Object.freeze({
  cpuUsage: null,
  cpuTemp: null,
  gpuUsage: null,
  gpuTemp: null,
  ram: null,
  disk: null,
  network: 0,
  networkBytesPerSecond: 0,
  sessionUptimeSeconds: 0,
  sampledAt: null,
  provider: 'cipher-vision',
  status: 'starting',
  error: null,
  sources: {},
});

const optionalPercent = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(100, Math.max(0, number))
    : null;
};

export function normalizeTelemetry(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Cipher Vision returned an invalid telemetry payload.');
  }

  return {
    ...EMPTY_TELEMETRY,
    ...payload,
    cpuUsage: optionalPercent(payload.cpuUsage),
    cpuTemp: optionalPercent(payload.cpuTemp),
    gpuUsage: optionalPercent(payload.gpuUsage),
    gpuTemp: optionalPercent(payload.gpuTemp),
    ram: optionalPercent(payload.ram),
    disk: optionalPercent(payload.disk),
    network: optionalPercent(payload.network) ?? 0,
    networkBytesPerSecond: Math.max(0, Number(payload.networkBytesPerSecond) || 0),
    sessionUptimeSeconds: Math.max(0, Math.floor(Number(payload.sessionUptimeSeconds) || 0)),
    provider: 'cipher-vision',
  };
}

export async function readTelemetry({ signal, fetcher = fetch } = {}) {
  const response = await fetcher('/api/telemetry', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? 'Cipher Vision telemetry request failed.');
  }
  return normalizeTelemetry(payload);
}
