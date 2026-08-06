import { appConfig } from '../../config/appConfig.js';
import { integrations } from '../../data/integrations.js';

export function listIntegrations() {
  return integrations.map((integration) => ({
    ...integration,
    connectionAllowed: appConfig.externalConnectionsEnabled,
  }));
}

export function getIntegrationConfigShape() {
  return {
    enabled: false,
    provider: 'mock',
    credentialReference: null,
    pollingIntervalMinutes: 15,
  };
}
