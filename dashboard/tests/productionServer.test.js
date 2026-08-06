import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createProductionServer } from '../server/productionServer.js';

function json(response) {
  return response.json();
}

function createTestRuntime() {
  const telemetry = {
    startCalls: 0,
    stopCalls: 0,
    start() {
      this.startCalls += 1;
    },
    stop() {
      this.stopCalls += 1;
    },
    async snapshot() {
      return {
        provider: 'test-sensor',
        status: 'live',
        cpuUsage: 1,
      };
    },
  };

  return {
    telemetry,
    runtime: {
      plugins: [
        {
          configureServer(server) {
            server.middlewares.use('/api/startup-gateway/status', (request, response) => {
              response.setHeader('Content-Type', 'application/json; charset=utf-8');
              response.end(JSON.stringify({ mode: 'safe', rgbActionsEnabled: false }));
            });
            server.middlewares.use('/api/theme-center/status', (request, response) => {
              response.setHeader('Content-Type', 'application/json; charset=utf-8');
              response.end(JSON.stringify({ realActionsEnabled: false, mode: 'safe' }));
            });
            telemetry.start();
            server.httpServer.once('close', () => telemetry.stop());
            server.middlewares.use('/api/telemetry', async (request, response) => {
              response.setHeader('Content-Type', 'application/json; charset=utf-8');
              response.end(JSON.stringify(await telemetry.snapshot()));
            });
          },
        },
      ],
    },
  };
}

async function withServer(callback) {
  const distDir = await mkdtemp(path.join(os.tmpdir(), 'cipher-prod-server-'));
  await writeFile(path.join(distDir, 'index.html'), '<!doctype html><div id="root">Cipher Core</div>', 'utf8');
  await writeFile(path.join(distDir, 'asset.txt'), 'asset-ok', 'utf8');
  const { runtime, telemetry } = createTestRuntime();
  const server = createProductionServer({
    distDir,
    runtime,
    logger: { error: () => {}, info: () => {} },
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await callback({ base, telemetry });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(distDir, { recursive: true, force: true });
  }
}

test('production server serves root HTML from dist', async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Cipher Core/);
  });
});

test('production server exposes Startup Gateway JSON', async () => {
  await withServer(async ({ base }) => {
    const payload = await json(await fetch(`${base}/api/startup-gateway/status`));
    assert.equal(payload.mode, 'safe');
    assert.equal(payload.rgbActionsEnabled, false);
  });
});

test('production server exposes Theme Center JSON', async () => {
  await withServer(async ({ base }) => {
    const payload = await json(await fetch(`${base}/api/theme-center/status`));
    assert.equal(payload.realActionsEnabled, false);
    assert.equal(payload.mode, 'safe');
  });
});

test('production server exposes telemetry JSON and closes owned telemetry lifecycle', async () => {
  await withServer(async ({ base, telemetry }) => {
    assert.equal(telemetry.startCalls, 1);
    const payload = await json(await fetch(`${base}/api/telemetry`));
    assert.equal(payload.provider, 'test-sensor');
    assert.equal(payload.status, 'live');
  });
});

test('production server returns JSON 404 for unknown API routes', async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/not-real`);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal((await response.json()).error, 'API route not found.');
  });
});

test('production server uses SPA fallback for client routes', async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/theme-center/deep-link`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Cipher Core/);
  });
});
