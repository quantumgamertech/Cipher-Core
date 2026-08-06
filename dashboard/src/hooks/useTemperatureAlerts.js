import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_TEMPERATURE_THRESHOLD,
  evaluateTemperatureAlert,
  normalizeTemperatureThreshold,
  TEMPERATURE_THRESHOLD_STORAGE_KEY,
} from '../services/telemetry/temperatureAlerts.js';

function readStoredThreshold() {
  try {
    return normalizeTemperatureThreshold(
      window.localStorage.getItem(TEMPERATURE_THRESHOLD_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_TEMPERATURE_THRESHOLD;
  }
}

export function useTemperatureAlerts(telemetry, { ownerUnlocked = false } = {}) {
  const [threshold, setThresholdState] = useState(readStoredThreshold);
  const [warning, setWarning] = useState(null);
  const previous = useRef({ cpu: false, gpu: false });

  useEffect(() => {
    const next = evaluateTemperatureAlert(previous.current, telemetry, threshold);
    if (next.changed) {
      setWarning(next.warning);
    }
    previous.current = next.current;
  }, [telemetry.cpuTemp, telemetry.gpuTemp, threshold]);

  const setThreshold = (value) => {
    if (!ownerUnlocked) return false;
    const next = normalizeTemperatureThreshold(value);
    setThresholdState(next);
    try {
      window.localStorage.setItem(TEMPERATURE_THRESHOLD_STORAGE_KEY, String(next));
    } catch {
      // The in-memory owner preference remains active when storage is unavailable.
    }
    return true;
  };

  return {
    threshold,
    setThreshold,
    warning,
  };
}
