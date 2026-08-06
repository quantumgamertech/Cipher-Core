import { appConfig } from '../../config/appConfig.js';
import { hardwareDevices } from '../../data/hardwareDevices.js';

export function getHardwareBusSnapshot() {
  return {
    controlEnabled: appConfig.hardwareControlEnabled,
    devices: hardwareDevices,
    sampledAt: new Date().toISOString(),
  };
}

export function requestHardwareAction() {
  return {
    accepted: false,
    reason: 'Hardware control is disabled in the pre-1.0 foundation.',
  };
}
