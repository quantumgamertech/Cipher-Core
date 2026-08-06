async function readGatewayResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const error = new Error(payload?.error ?? 'Startup Gateway request failed.');
    error.code = payload?.code;
    error.failedStep = payload?.failedStep;
    throw error;
  }
  return payload;
}

export const STARTUP_ACTIVATION_MODE = 'live';

export function canShowLabMode(status) {
  return status?.ownerUnlocked === true;
}

export async function getStartupGatewayStatus() {
  return readGatewayResponse(await fetch('/api/startup-gateway/status'));
}

export async function selectStartupMode(mode) {
  return readGatewayResponse(await fetch('/api/startup-gateway/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  }));
}

export async function unlockOwnerAccess(pin) {
  return readGatewayResponse(await fetch('/api/startup-gateway/unlock', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  }));
}
