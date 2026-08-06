import { startProductionServer } from './productionServer.js';

const port = Number(process.env.CIPHER_DASHBOARD_PORT || 5173);
const host = process.env.CIPHER_DASHBOARD_HOST || '127.0.0.1';

let shuttingDown = false;

function closeServer(server, reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[ProductionServer] shutdown requested: ${reason}`);
  server.close((error) => {
    if (error) {
      console.error(`[ProductionServer] shutdown failed: ${error.message}`);
      process.exit(1);
      return;
    }
    console.info('[ProductionServer] shutdown complete');
    process.exit(0);
  });
}

startProductionServer({ host, port }).then((server) => {
  process.once('SIGINT', () => closeServer(server, 'SIGINT'));
  process.once('SIGTERM', () => closeServer(server, 'SIGTERM'));
}).catch((error) => {
  console.error(`[ProductionServer] failed to start: ${error.stack || error.message}`);
  process.exit(1);
});
