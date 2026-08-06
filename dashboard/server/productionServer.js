import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipherRuntime } from './runtime.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 5173;
const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
});

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DIST_DIR = path.resolve(here, '..', 'dist');

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function createMiddlewareHost(httpServer) {
  const stack = [];
  return {
    httpServer,
    middlewares: {
      use(routePath, handler) {
        if (typeof routePath === 'function') {
          stack.push({ routePath: '/', handler: routePath });
          return;
        }
        stack.push({ routePath, handler });
      },
    },
    async handle(request, response) {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      const layer = stack.find((entry) => pathname === entry.routePath
        || pathname.startsWith(`${entry.routePath}/`));
      if (!layer) return false;
      await layer.handler(request, response);
      return true;
    },
  };
}

function safeAssetPath(distDir, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(distDir, relativePath);
  const relative = path.relative(distDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function serveFile(response, filePath) {
  response.statusCode = 200;
  response.setHeader('Content-Type', MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  createReadStream(filePath).pipe(response);
}

export function createProductionServer({
  distDir = DEFAULT_DIST_DIR,
  runtime = createCipherRuntime(),
  logger = console,
} = {}) {
  let host;
  const server = http.createServer(async (request, response) => {
    try {
      if (await host.handle(request, response)) return;

      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      if (pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'API route not found.' });
        return;
      }

      const assetPath = safeAssetPath(distDir, pathname);
      if (assetPath && await fileExists(assetPath)) {
        await serveFile(response, assetPath);
        return;
      }

      const fallback = path.join(distDir, 'index.html');
      if (await fileExists(fallback)) {
        await serveFile(response, fallback);
        return;
      }

      sendJson(response, 503, {
        error: `Cipher Core production assets were not found at ${distDir}. Run npm.cmd run build first.`,
      });
    } catch (error) {
      logger.error?.(`[ProductionServer] request failed: ${error.stack || error.message}`);
      sendJson(response, 500, { error: 'Cipher Core production server failed.' });
    }
  });

  host = createMiddlewareHost(server);
  for (const plugin of runtime.plugins ?? []) {
    const configure = plugin.configureServer ?? plugin.configurePreviewServer;
    configure?.(host);
  }

  return server;
}

export function startProductionServer({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  distDir = DEFAULT_DIST_DIR,
  runtime = createCipherRuntime(),
  logger = console,
} = {}) {
  const server = createProductionServer({ distDir, runtime, logger });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      logger.info?.(`[ProductionServer] listening on http://${host}:${port}`);
      resolve(server);
    });
  });
}
