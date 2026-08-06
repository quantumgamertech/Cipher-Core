import net from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OPENRGB_EFFECTS_BRIDGE_PIPE = String.raw`\\.\pipe\CipherCore.OpenRGBEffects.v1`;
export const AIDA64_AIO_BRIDGE_PIPE = String.raw`\\.\pipe\CipherCore.AIDA64.v1`;

export const THEME_COMMANDS = Object.freeze({
  Default: 'LOAD Default',
  PurpleBlue: 'LOAD PurpleBlue',
  Inferno: 'LOAD Inferno',
  Ice: 'LOAD Ice',
  Matrix: 'LOAD Matrix',
  Stealth: 'LOAD Stealth',
});

export const AIDA64_LAYOUT_FILES = Object.freeze({
  Default: String.raw`Permanent_Master\QGT_Inferno_RedOrange.ralcd`,
  PurpleBlue: 'QGT_Neon_PurpleBlue.ralcd',
  Inferno: 'QGT_Inferno_RedOrange.ralcd',
  Ice: 'QGT_Ice_WhiteCyan.ralcd',
  Matrix: 'QGT_Matrix_Green.ralcd',
  Stealth: 'QGT_Stealth_White.ralcd',
});

const MAX_BRIDGE_RESPONSE_BYTES = 1_024;
const QGT_THEME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'QGT_Themes');

export function themeActionsEnabled(environment = process.env) {
  return String(environment.ENABLE_THEME_ACTIONS).toLowerCase() === 'true';
}

export function aida64ActionsEnabled(environment = process.env) {
  return String(environment.ENABLE_AIDA64_AIO_ACTIONS).toLowerCase() === 'true';
}

function createThemeError(message, code, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

export function getThemeCommand(themeId) {
  if (typeof themeId !== 'string' || !Object.hasOwn(THEME_COMMANDS, themeId)) {
    throw createThemeError(`Unknown theme: ${String(themeId)}`, 'INVALID_THEME');
  }
  return THEME_COMMANDS[themeId];
}

export function getAida64LayoutPath(themeId) {
  if (typeof themeId !== 'string' || !Object.hasOwn(AIDA64_LAYOUT_FILES, themeId)) {
    throw createThemeError(`Unknown theme: ${String(themeId)}`, 'INVALID_THEME');
  }
  return resolve(QGT_THEME_DIR, AIDA64_LAYOUT_FILES[themeId]);
}

function action(id, order, label, targetPath, message, available = true, extra = {}) {
  return { id, order, label, path: targetPath, message, available, ...extra };
}

export function buildThemeDryRun(themeId, environment = process.env) {
  const command = getThemeCommand(themeId);
  const layoutPath = getAida64LayoutPath(themeId);
  const layoutAvailable = existsSync(layoutPath);
  const aidaLive = aida64ActionsEnabled(environment);
  return {
    ok: true,
    dryRun: true,
    realActionsEnabled: themeActionsEnabled(environment),
    aida64ActionsEnabled: aidaLive,
    themeId,
    generatedAt: new Date().toISOString(),
    actions: [
      action(
        'openrgb-effect',
        1,
        'Load OpenRGB effect',
        OPENRGB_EFFECTS_BRIDGE_PIPE,
        `Would send ${command} to the running OpenRGB Effects bridge.`,
      ),
      action(
        'aida64-aio-layout',
        2,
        'Prepare AIDA64 AIO layout',
        layoutPath,
        aidaLive
          ? `Would ask the AIDA64 AIO bridge to load ${AIDA64_LAYOUT_FILES[themeId]}.`
          : 'AIDA64 AIO actions are locked until a real auto-import bridge is available.',
        layoutAvailable,
        { skipped: !aidaLive },
      ),
    ],
    allRequiredAssetsAvailable: true,
    filesChanged: 0,
    commands: [],
    futureActions: {
      aida64: aidaLive ? 'auto-import-bridge' : 'disabled',
      wallpaper: 'disabled',
      windowsAccent: 'disabled',
      streamDeck: 'planned',
    },
  };
}

export function sendOpenRgbBridgeCommand(
  themeId,
  {
    connect = (pipePath) => net.createConnection(pipePath),
    timeoutMs = 5_000,
  } = {},
) {
  let command;
  try {
    command = getThemeCommand(themeId);
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let responseBuffer = '';
    let socket;
    let timeout;

    const finish = (error, response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.destroy?.();
      if (error) reject(error);
      else resolve(response);
    };

    try {
      socket = connect(OPENRGB_EFFECTS_BRIDGE_PIPE);
    } catch (cause) {
      finish(createThemeError(
        `OpenRGB Effects bridge is unavailable: ${cause.message}`,
        'BRIDGE_DISCONNECTED',
        cause,
      ));
      return;
    }

    timeout = setTimeout(() => {
      finish(createThemeError(
        `OpenRGB Effects bridge timed out after ${timeoutMs}ms.`,
        'BRIDGE_TIMEOUT',
      ));
    }, timeoutMs);

    socket.setEncoding?.('utf8');
    socket.once('connect', () => {
      console.info(`[ThemeCenter] bridge send: ${command}`);
      socket.write(`${command}\n`);
    });
    socket.on('data', (chunk) => {
      responseBuffer += chunk;
      if (Buffer.byteLength(responseBuffer, 'utf8') > MAX_BRIDGE_RESPONSE_BYTES) {
        finish(createThemeError(
          'OpenRGB Effects bridge response exceeded the allowed size.',
          'BRIDGE_RESPONSE_ERROR',
        ));
        return;
      }

      const newline = responseBuffer.indexOf('\n');
      if (newline < 0) return;

      const response = responseBuffer.slice(0, newline).trim();
      console.info(`[ThemeCenter] bridge response: ${response}`);
      if (response === 'OK QUEUED') {
        finish(null, response);
      } else if (/^ERROR INVALID_THEME\b/i.test(response)) {
        finish(createThemeError(
          `OpenRGB Effects bridge rejected theme ${themeId}.`,
          'INVALID_THEME',
        ));
      } else {
        finish(createThemeError(
          `Unexpected OpenRGB Effects bridge response: ${response || '<empty>'}`,
          'BRIDGE_RESPONSE_ERROR',
        ));
      }
    });
    socket.once('error', (cause) => {
      finish(createThemeError(
        `OpenRGB Effects bridge is unavailable: ${cause.message}`,
        'BRIDGE_DISCONNECTED',
        cause,
      ));
    });
    socket.once('end', () => {
      finish(createThemeError(
        'OpenRGB Effects bridge closed before returning a response.',
        'BRIDGE_DISCONNECTED',
      ));
    });
  });
}

export function sendAida64BridgeCommand(
  themeId,
  {
    connect = (pipePath) => net.createConnection(pipePath),
    timeoutMs = 5_000,
  } = {},
) {
  let command;
  try {
    command = getThemeCommand(themeId);
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let responseBuffer = '';
    let socket;
    let timeout;

    const finish = (error, response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.destroy?.();
      if (error) reject(error);
      else resolve(response);
    };

    try {
      socket = connect(AIDA64_AIO_BRIDGE_PIPE);
    } catch (cause) {
      finish(createThemeError(
        `AIDA64 AIO bridge is unavailable: ${cause.message}`,
        'AIDA64_BRIDGE_DISCONNECTED',
        cause,
      ));
      return;
    }

    timeout = setTimeout(() => {
      finish(createThemeError(
        `AIDA64 AIO bridge timed out after ${timeoutMs}ms.`,
        'AIDA64_BRIDGE_TIMEOUT',
      ));
    }, timeoutMs);

    socket.setEncoding?.('utf8');
    socket.once('connect', () => {
      console.info(`[ThemeCenter] AIDA64 bridge send: ${command}`);
      socket.write(`${command}\n`);
    });
    socket.on('data', (chunk) => {
      responseBuffer += chunk;
      if (Buffer.byteLength(responseBuffer, 'utf8') > MAX_BRIDGE_RESPONSE_BYTES) {
        finish(createThemeError(
          'AIDA64 AIO bridge response exceeded the allowed size.',
          'AIDA64_BRIDGE_RESPONSE_ERROR',
        ));
        return;
      }

      const newline = responseBuffer.indexOf('\n');
      if (newline < 0) return;

      const response = responseBuffer.slice(0, newline).trim();
      console.info(`[ThemeCenter] AIDA64 bridge response: ${response}`);
      if (response === 'OK APPLIED') {
        finish(null, response);
      } else if (/^ERROR INVALID_THEME\b/i.test(response)) {
        finish(createThemeError(
          `AIDA64 AIO bridge rejected theme ${themeId}.`,
          'INVALID_THEME',
        ));
      } else {
        finish(createThemeError(
          `Unexpected AIDA64 AIO bridge response: ${response || '<empty>'}`,
          'AIDA64_BRIDGE_RESPONSE_ERROR',
        ));
      }
    });
    socket.once('error', (cause) => {
      finish(createThemeError(
        `AIDA64 AIO bridge is unavailable: ${cause.message}`,
        'AIDA64_BRIDGE_DISCONNECTED',
        cause,
      ));
    });
    socket.once('end', () => {
      finish(createThemeError(
        'AIDA64 AIO bridge closed before returning a response.',
        'AIDA64_BRIDGE_DISCONNECTED',
      ));
    });
  });
}

export function checkAida64BridgeReady({
  connect = (pipePath) => net.createConnection(pipePath),
  timeoutMs = 750,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let responseBuffer = '';
    let socket;
    let timeout;

    const finish = (ready) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.destroy?.();
      resolve(ready);
    };

    try {
      socket = connect(AIDA64_AIO_BRIDGE_PIPE);
    } catch {
      finish(false);
      return;
    }

    timeout = setTimeout(() => finish(false), timeoutMs);
    socket.setEncoding?.('utf8');
    socket.once('connect', () => {
      socket.write('STATUS\n');
    });
    socket.on('data', (chunk) => {
      responseBuffer += chunk;
      if (Buffer.byteLength(responseBuffer, 'utf8') > MAX_BRIDGE_RESPONSE_BYTES) {
        finish(false);
        return;
      }

      const newline = responseBuffer.indexOf('\n');
      if (newline < 0) return;
      finish(responseBuffer.slice(0, newline).trim() === 'OK READY');
    });
    socket.once('error', () => finish(false));
    socket.once('end', () => finish(false));
  });
}

export function createApplyLock() {
  let inFlight = false;
  return {
    get locked() {
      return inFlight;
    },
    async run(operation) {
      if (inFlight) {
        throw createThemeError(
          'Another theme apply is already in progress.',
          'APPLY_LOCKED',
        );
      }
      inFlight = true;
      try {
        return await operation();
      } finally {
        inFlight = false;
      }
    },
  };
}

const applyLock = createApplyLock();

export async function applyTheme(
  themeId,
  environment = process.env,
  {
    bridgeClient = sendOpenRgbBridgeCommand,
    aida64BridgeClient = sendAida64BridgeCommand,
    target = 'all',
  } = {},
) {
  const plan = buildThemeDryRun(themeId, environment);
  const rgbLive = plan.realActionsEnabled && target !== 'aida64';
  const aidaLive = plan.aida64ActionsEnabled && target !== 'openrgb';
  if (!rgbLive && !aidaLive) return plan;

  const command = getThemeCommand(themeId);
  const actions = [];
  const commands = [];
  try {
    let rgbResponse = null;
    let aida64Response = null;

    if (rgbLive) {
      rgbResponse = await bridgeClient(themeId);
      if (rgbResponse !== 'OK QUEUED') {
        throw createThemeError(
          `Unexpected OpenRGB Effects bridge response: ${String(rgbResponse)}`,
          'BRIDGE_RESPONSE_ERROR',
        );
      }
      commands.push(command);
      actions.push(
        action(
          'openrgb-effect',
          1,
          'Load OpenRGB effect',
          OPENRGB_EFFECTS_BRIDGE_PIPE,
          `${themeId} was queued by the running OpenRGB Effects bridge (${rgbResponse}).`,
          true,
          { state: 'Queued' },
        ),
      );
    } else {
      actions.push({ ...plan.actions[0], skipped: true });
    }

    if (aidaLive) {
      aida64Response = await aida64BridgeClient(themeId);
      if (aida64Response !== 'OK APPLIED') {
        throw createThemeError(
          `Unexpected AIDA64 AIO bridge response: ${String(aida64Response)}`,
          'AIDA64_BRIDGE_RESPONSE_ERROR',
        );
      }
      commands.push(command);
      actions.push(
        action(
          'aida64-aio-layout',
          2,
          'Select AIDA64 AIO layout',
          getAida64LayoutPath(themeId),
          `${themeId} was applied by the AIDA64 AIO bridge (${aida64Response}).`,
          true,
          { state: 'Applied' },
        ),
      );
    } else {
      actions.push(plan.actions[1]);
    }

    return {
      ...plan,
      dryRun: false,
      generatedAt: new Date().toISOString(),
      actions,
      openRgbMode: rgbLive ? 'named-pipe-bridge' : 'locked',
      aida64Mode: aidaLive ? 'auto-import-bridge' : 'locked',
      bridgeResponse: rgbResponse,
      aida64BridgeResponse: aida64Response,
      filesChanged: 0,
      commands,
      target,
    };
  } catch (error) {
    error.commandLog = [command];
    error.failedStep = error.code?.startsWith('AIDA64_')
      ? 'Send AIDA64 AIO bridge command'
      : 'Send OpenRGB Effects bridge command';
    throw error;
  }
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(createThemeError('Request body is too large.', 'INVALID_REQUEST'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function errorStatus(error) {
  if (error.code === 'INVALID_THEME' || error.code === 'INVALID_REQUEST') return 400;
  if (error.code === 'APPLY_LOCKED') return 409;
  if (error.code === 'BRIDGE_TIMEOUT' || error.code === 'AIDA64_BRIDGE_TIMEOUT') return 504;
  if (error.code === 'BRIDGE_DISCONNECTED' || error.code === 'AIDA64_BRIDGE_DISCONNECTED') return 503;
  if (error.code === 'RGB_BRIDGE_OFFLINE') return 503;
  return 502;
}

export function themeCenterApi({
  themeActionsAllowed = () => themeActionsEnabled(),
  environment = process.env,
  aida64BridgeReady = checkAida64BridgeReady,
  ownerAccess = { isAuthorized: () => false },
  getRuntimeStatus = async () => ({
    mode: themeActionsAllowed() ? 'lab' : 'safe',
    rgbActionsEnabled: themeActionsAllowed(),
    aida64ActionsEnabled: aida64ActionsEnabled(environment),
    labReady: themeActionsAllowed(),
    rgbBridgeStatus: themeActionsAllowed() ? 'lab-ready' : 'offline',
  }),
} = {}) {
  return {
    name: 'cipher-theme-center',
    configureServer(server) {
      server.middlewares.use('/api/theme-center/status', async (request, response) => {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'Method not allowed.' });
          return;
        }
        const runtime = await getRuntimeStatus();
        const live = Boolean(runtime.rgbActionsEnabled);
        const aidaToggle = Boolean(runtime.aida64ActionsEnabled ?? aida64ActionsEnabled(environment));
        const ownerAuthorized = ownerAccess.isAuthorized(request.headers.cookie);
        const aidaReady = ownerAuthorized && aidaToggle && await aida64BridgeReady();
        sendJson(response, 200, {
          realActionsEnabled: live,
          aida64ActionsEnabled: aidaReady,
          mode: runtime.mode,
          labReady: Boolean(runtime.labReady),
          rgbBridgeStatus: runtime.rgbBridgeStatus ?? 'offline',
          aida64BridgeStatus: aidaReady ? 'auto-import-ready' : 'locked',
          message: runtime.message,
          rgbApplyPath: 'named-pipe-bridge',
          aida64ApplyPath: 'auto-import-bridge',
        });
      });

      server.middlewares.use('/api/theme-center/apply', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed.' });
          return;
        }
        if (applyLock.locked) {
          sendJson(response, 409, {
            error: 'Another theme apply is already in progress.',
            failedStep: 'Acquire theme apply lock',
            code: 'APPLY_LOCKED',
            commands: [],
          });
          return;
        }

        try {
          const result = await applyLock.run(async () => {
            const body = await readRequestBody(request);
            let payload;
            try {
              payload = JSON.parse(body || '{}');
            } catch {
              throw createThemeError('Request body must be valid JSON.', 'INVALID_REQUEST');
            }

            const { themeId, target = 'all' } = payload;
            if (!['all', 'openrgb', 'aida64'].includes(target)) {
              throw createThemeError('Unknown theme apply target.', 'INVALID_REQUEST');
            }
            const runtime = await getRuntimeStatus();
            const live = Boolean(runtime.rgbActionsEnabled);
            const ownerAuthorized = ownerAccess.isAuthorized(request.headers.cookie);
            if (runtime.mode === 'lab' && !live) {
              const error = createThemeError(
                runtime.message || 'RGB Bridge Offline.',
                'RGB_BRIDGE_OFFLINE',
              );
              error.failedStep = 'Validate RGB bridge readiness';
              throw error;
            }
            console.info(`[ThemeCenter] apply request: theme=${themeId ?? '<missing>'} enabled=${live}`);
            const aidaReady = ownerAuthorized
              && aida64ActionsEnabled(environment)
              && await aida64BridgeReady();
            const applied = await applyTheme(themeId, {
              ENABLE_THEME_ACTIONS: live ? 'true' : 'false',
              ENABLE_AIDA64_AIO_ACTIONS: aidaReady ? 'true' : 'false',
            }, {
              target,
            });
            console.info(`[ThemeCenter] apply result: theme=${themeId} mode=${applied.dryRun ? 'dry-run' : 'live'} filesChanged=0`);
            return applied;
          });
          sendJson(response, 200, result);
        } catch (error) {
          console.error(`[ThemeCenter] apply failed: step=${error.failedStep ?? 'Request validation'} error=${error.message}`);
          sendJson(response, errorStatus(error), {
            error: error.message,
            code: error.code,
            failedStep: error.failedStep ?? 'Request validation',
            commands: error.commandLog ?? [],
          });
        }
      });
    },
  };
}
