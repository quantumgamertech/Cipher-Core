export function formatThemeApplyError(payload) {
  return payload?.failedStep
    ? `Failed at ${payload.failedStep}: ${payload.error}`
    : payload?.error ?? 'Theme Center apply failed.';
}

export function createThemeApplyGuard({
  debounceMs = 750,
  now = () => Date.now(),
} = {}) {
  let inFlight = false;
  let lastApplyAt = Number.NEGATIVE_INFINITY;

  return {
    get locked() {
      return inFlight;
    },
    tryAcquire() {
      const current = now();
      if (inFlight || current - lastApplyAt < debounceMs) return false;
      inFlight = true;
      lastApplyAt = current;
      return true;
    },
    release() {
      inFlight = false;
    },
  };
}

export async function applyTheme(themeId, { target = 'all' } = {}) {
  const response = await fetch('/api/theme-center/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ themeId, target }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const error = new Error(formatThemeApplyError(payload));
    error.failedStep = payload?.failedStep;
    error.code = payload?.code;
    error.backupPath = payload?.backupPath;
    error.commands = payload?.commands ?? [];
    throw error;
  }

  return payload;
}

export async function getThemeCenterStatus() {
  const response = await fetch('/api/theme-center/status');
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? 'Theme Center status check failed.');
  }
  return payload;
}
