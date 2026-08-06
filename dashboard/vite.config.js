import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { themeCenterApi } from './server/themeCenter.js';
import { SensorEngine, sensorEngineApi } from './server/sensorEngine.js';
import { voiceApi } from './server/voice.js';
import {
  createStartupGateway,
  createOwnerAccess,
  startupGatewayApi,
} from './server/startupGateway.js';

export default defineConfig(({ mode }) => {
  const serverEnvironment = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), ''),
  };
  const startupGateway = createStartupGateway();
  const ownerAccess = createOwnerAccess({ environment: serverEnvironment });
  const sensorEngine = new SensorEngine();

  return {
    plugins: [
      react(),
      startupGatewayApi(startupGateway, ownerAccess, {
        onOwnerUnlocked: () => sensorEngine.hardware.enableElevatedAccess(),
      }),
      themeCenterApi({
        environment: serverEnvironment,
        ownerAccess,
        themeActionsAllowed: () => startupGateway.status().rgbActionsEnabled,
        getRuntimeStatus: async () => ({
          ...(await startupGateway.checkRgbHealth()),
          aida64ActionsEnabled: String(serverEnvironment.ENABLE_AIDA64_AIO_ACTIONS).toLowerCase() === 'true',
        }),
      }),
      sensorEngineApi({ engine: sensorEngine }),
      voiceApi({ environment: serverEnvironment }),
    ],
    server: {
      host: '127.0.0.1',
    },
  };
});
