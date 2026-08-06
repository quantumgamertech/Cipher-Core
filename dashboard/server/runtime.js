import { themeCenterApi } from './themeCenter.js';
import { SensorEngine, sensorEngineApi } from './sensorEngine.js';
import { voiceApi } from './voice.js';
import {
  createStartupGateway,
  createOwnerAccess,
  startupGatewayApi,
} from './startupGateway.js';

export function createCipherRuntime({
  environment = process.env,
  startupGateway = createStartupGateway(),
  ownerAccess = createOwnerAccess({ environment }),
  sensorEngine = new SensorEngine(),
  fetcher = fetch,
  logger = console,
} = {}) {
  return {
    startupGateway,
    ownerAccess,
    sensorEngine,
    plugins: [
      startupGatewayApi(startupGateway, ownerAccess, {
        onOwnerUnlocked: () => sensorEngine.hardware?.enableElevatedAccess?.(),
      }),
      themeCenterApi({
        environment,
        ownerAccess,
        themeActionsAllowed: () => startupGateway.status().rgbActionsEnabled,
        getRuntimeStatus: async () => ({
          ...(await startupGateway.checkRgbHealth()),
          aida64ActionsEnabled: String(environment.ENABLE_AIDA64_AIO_ACTIONS).toLowerCase() === 'true',
        }),
      }),
      sensorEngineApi({ engine: sensorEngine }),
      voiceApi({ environment, fetcher, logger }),
    ],
  };
}
