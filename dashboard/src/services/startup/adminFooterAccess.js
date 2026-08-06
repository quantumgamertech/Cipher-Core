export const ADMIN_MODES = Object.freeze({
  LIVE: 'live',
  LAB: 'lab',
});

export function isOwnerAuthenticated(status) {
  return status?.ownerUnlocked === true;
}

export function getAdminExecutionMode(status) {
  return status?.mode === ADMIN_MODES.LAB ? 'Lab Mode' : 'Live Mode';
}

export function getOwnerAccessStatus(status) {
  return isOwnerAuthenticated(status) ? 'OWNER ACCESS UNLOCKED' : 'OWNER ACCESS LOCKED';
}

export function getRgbBridgeStatus(status) {
  return String(status?.rgbBridgeStatus ?? 'offline').toUpperCase();
}

export function getExternalActionStatus(status) {
  return status?.rgbActionsEnabled === true ? 'EXTERNAL ACTIONS UNLOCKED' : 'EXTERNAL ACTIONS LOCKED';
}

export function getAdminModeAction(status) {
  if (status?.mode === ADMIN_MODES.LAB) {
    return { label: 'RETURN TO LIVE MODE', mode: ADMIN_MODES.LIVE };
  }
  return { label: 'ENTER LAB MODE', mode: ADMIN_MODES.LAB };
}

export async function unlockAdminOwnerAccess(pin, { unlockOwnerAccess }) {
  return unlockOwnerAccess(pin);
}

export async function runAdminModeAction(status, { selectStartupMode }) {
  const action = getAdminModeAction(status);
  return selectStartupMode(action.mode);
}
