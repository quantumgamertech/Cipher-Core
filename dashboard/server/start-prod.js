import { startProductionServer } from './productionServer.js';

const port = Number(process.env.CIPHER_DASHBOARD_PORT || 5173);
const host = process.env.CIPHER_DASHBOARD_HOST || '127.0.0.1';

startProductionServer({ host, port }).catch((error) => {
  console.error(`[ProductionServer] failed to start: ${error.stack || error.message}`);
  process.exit(1);
});
