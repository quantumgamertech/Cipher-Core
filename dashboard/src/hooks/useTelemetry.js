import { useEffect, useState } from 'react';
import {
  EMPTY_TELEMETRY,
  readTelemetry,
} from '../services/telemetry/telemetryService.js';

export function useTelemetry(intervalMs = 1000) {
  const [telemetry, setTelemetry] = useState(EMPTY_TELEMETRY);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const controller = new AbortController();

    const refresh = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const next = await readTelemetry({ signal: controller.signal });
        if (active) setTelemetry(next);
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setTelemetry((current) => ({
            ...current,
            status: 'degraded',
            error: error.message,
          }));
        }
      } finally {
        requestInFlight = false;
      }
    };

    refresh();
    const timer = window.setInterval(refresh, intervalMs);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return telemetry;
}
