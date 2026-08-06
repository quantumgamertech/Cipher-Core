export const TEMPERATURE_THRESHOLDS = Object.freeze([85, 95, 100]);
export const DEFAULT_TEMPERATURE_THRESHOLD = 95;
export const TEMPERATURE_THRESHOLD_STORAGE_KEY = 'cipher.temperatureAlertThreshold';

export function normalizeTemperatureThreshold(value) {
  const threshold = Number(value);
  return TEMPERATURE_THRESHOLDS.includes(threshold)
    ? threshold
    : DEFAULT_TEMPERATURE_THRESHOLD;
}

export function temperatureAlertState(telemetry, threshold) {
  const selectedThreshold = normalizeTemperatureThreshold(threshold);
  const cpuTemperature = Number(telemetry?.cpuTemp);
  const gpuTemperature = Number(telemetry?.gpuTemp);

  return {
    cpu: telemetry?.cpuTemp !== null
      && telemetry?.cpuTemp !== undefined
      && Number.isFinite(cpuTemperature)
      && cpuTemperature >= selectedThreshold,
    gpu: telemetry?.gpuTemp !== null
      && telemetry?.gpuTemp !== undefined
      && Number.isFinite(gpuTemperature)
      && gpuTemperature >= selectedThreshold,
  };
}

export function evaluateTemperatureAlert(previous, telemetry, threshold) {
  const current = temperatureAlertState(telemetry, threshold);
  const newlyOver = (current.cpu && !previous.cpu)
    || (current.gpu && !previous.gpu);
  const droppedBelow = (!current.cpu && previous.cpu)
    || (!current.gpu && previous.gpu);
  const sensors = [
    current.cpu && { name: 'CPU', temperature: Number(telemetry.cpuTemp) },
    current.gpu && { name: 'GPU', temperature: Number(telemetry.gpuTemp) },
  ].filter(Boolean);

  return {
    current,
    changed: newlyOver || droppedBelow,
    warning: sensors.length > 0
      ? { sensors, threshold: normalizeTemperatureThreshold(threshold) }
      : null,
  };
}
