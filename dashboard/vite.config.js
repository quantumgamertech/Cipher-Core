import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createCipherRuntime } from './server/runtime.js';

export default defineConfig(({ mode }) => {
  const serverEnvironment = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), ''),
  };
  const runtime = createCipherRuntime({ environment: serverEnvironment });

  return {
    plugins: [
      react(),
      ...runtime.plugins,
    ],
    server: {
      host: '127.0.0.1',
    },
  };
});
