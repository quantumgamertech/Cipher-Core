import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  AIDA64_AIO_BRIDGE_PIPE,
  AIDA64_LAYOUT_FILES,
  aida64ActionsEnabled,
  applyTheme,
  buildThemeDryRun,
  createApplyLock,
  getAida64LayoutPath,
  getThemeCommand,
  OPENRGB_EFFECTS_BRIDGE_PIPE,
  sendAida64BridgeCommand,
  sendOpenRgbBridgeCommand,
  THEME_COMMANDS,
  themeCenterApi,
  themeActionsEnabled,
} from '../server/themeCenter.js';
import {
  createThemeApplyGuard,
  formatThemeApplyError,
} from '../src/services/themes/themeCenterService.js';
import {
  DEFAULT_THEME_APPEARANCE,
  previewThemeAppearance,
  readThemeAppearance,
  resetThemeAppearance,
  storeThemeAppearance,
} from '../src/services/themes/themeAppearance.js';

function createBridgeSocket(response = 'OK QUEUED') {
  const socket = new EventEmitter();
  socket.setEncoding = () => {};
  socket.destroy = () => {};
  socket.write = (command) => {
    socket.command = command;
    queueMicrotask(() => socket.emit('data', `${response}\n`));
  };
  queueMicrotask(() => socket.emit('connect'));
  return socket;
}

function createJsonResponse() {
  return {
    statusCode: null,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.payload = JSON.parse(body);
    },
  };
}

test('theme actions are dry-run unless the exact environment toggle is true', () => {
  assert.equal(themeActionsEnabled({}), false);
  assert.equal(themeActionsEnabled({ ENABLE_THEME_ACTIONS: 'false' }), false);
  assert.equal(themeActionsEnabled({ ENABLE_THEME_ACTIONS: '1' }), false);
  assert.equal(themeActionsEnabled({ ENABLE_THEME_ACTIONS: 'TRUE' }), true);
  assert.equal(aida64ActionsEnabled({}), false);
  assert.equal(aida64ActionsEnabled({ ENABLE_AIDA64_AIO_ACTIONS: '1' }), false);
  assert.equal(aida64ActionsEnabled({ ENABLE_AIDA64_AIO_ACTIONS: 'TRUE' }), true);
});

test('dry-run performs no bridge call and reports zero changes', async () => {
  let bridgeCalls = 0;
  const result = await applyTheme('PurpleBlue', {}, {
    bridgeClient: async () => {
      bridgeCalls += 1;
      return 'OK QUEUED';
    },
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.realActionsEnabled, false);
  assert.equal(result.aida64ActionsEnabled, false);
  assert.equal(result.filesChanged, 0);
  assert.deepEqual(result.commands, []);
  assert.equal(bridgeCalls, 0);
  assert.match(result.actions[0].message, /Would send LOAD PurpleBlue/);
  assert.match(result.actions[1].message, /AIDA64 AIO actions are locked/);
});

test('supported themes map exactly to the approved bridge commands', () => {
  assert.deepEqual(THEME_COMMANDS, {
    Default: 'LOAD Default',
    PurpleBlue: 'LOAD PurpleBlue',
    Inferno: 'LOAD Inferno',
    Ice: 'LOAD Ice',
    Matrix: 'LOAD Matrix',
    Stealth: 'LOAD Stealth',
  });
});

test('AIDA64 layouts map exactly to approved ROG AIO files', () => {
  assert.deepEqual(AIDA64_LAYOUT_FILES, {
    Default: String.raw`Permanent_Master\QGT_Inferno_RedOrange.ralcd`,
    PurpleBlue: 'QGT_Neon_PurpleBlue.ralcd',
    Inferno: 'QGT_Inferno_RedOrange.ralcd',
    Ice: 'QGT_Ice_WhiteCyan.ralcd',
    Matrix: 'QGT_Matrix_Green.ralcd',
    Stealth: 'QGT_Stealth_White.ralcd',
  });
  assert.match(getAida64LayoutPath('Inferno'), /QGT_Inferno_RedOrange\.ralcd$/);
});

test('each supported theme sends exactly one approved named-pipe command', async () => {
  for (const [themeId, command] of Object.entries(THEME_COMMANDS)) {
    let connectedPath;
    const socket = createBridgeSocket();
    const response = await sendOpenRgbBridgeCommand(themeId, {
      connect: (pipePath) => {
        connectedPath = pipePath;
        return socket;
      },
    });

    assert.equal(connectedPath, OPENRGB_EFFECTS_BRIDGE_PIPE, themeId);
    assert.equal(socket.command, `${command}\n`, themeId);
    assert.equal(response, 'OK QUEUED', themeId);
  }
});

test('each supported theme can be applied to the AIDA64 AIO bridge', async () => {
  for (const [themeId, command] of Object.entries(THEME_COMMANDS)) {
    let connectedPath;
    const socket = createBridgeSocket('OK APPLIED');
    const response = await sendAida64BridgeCommand(themeId, {
      connect: (pipePath) => {
        connectedPath = pipePath;
        return socket;
      },
    });

    assert.equal(connectedPath, AIDA64_AIO_BRIDGE_PIPE, themeId);
    assert.equal(socket.command, `${command}\n`, themeId);
    assert.equal(response, 'OK APPLIED', themeId);
  }
});

test('live apply accepts only OK QUEUED and changes no files', async () => {
  const calls = [];
  const result = await applyTheme(
    'Inferno',
    { ENABLE_THEME_ACTIONS: 'true' },
    {
      bridgeClient: async (themeId) => {
        calls.push(themeId);
        return 'OK QUEUED';
      },
    },
  );

  assert.deepEqual(calls, ['Inferno']);
  assert.equal(result.dryRun, false);
  assert.equal(result.bridgeResponse, 'OK QUEUED');
  assert.equal(result.aida64BridgeResponse, null);
  assert.equal(result.openRgbMode, 'named-pipe-bridge');
  assert.equal(result.aida64Mode, 'locked');
  assert.equal(result.filesChanged, 0);
  assert.deepEqual(result.commands, ['LOAD Inferno']);
});

test('single theme apply queues matching OpenRGB and AIDA64 layouts', async () => {
  const rgbCalls = [];
  const aida64Calls = [];
  const result = await applyTheme(
    'Matrix',
    {
      ENABLE_THEME_ACTIONS: 'true',
      ENABLE_AIDA64_AIO_ACTIONS: 'true',
    },
    {
      bridgeClient: async (themeId) => {
        rgbCalls.push(themeId);
        return 'OK QUEUED';
      },
      aida64BridgeClient: async (themeId) => {
        aida64Calls.push(themeId);
        return 'OK APPLIED';
      },
    },
  );

  assert.deepEqual(rgbCalls, ['Matrix']);
  assert.deepEqual(aida64Calls, ['Matrix']);
  assert.equal(result.openRgbMode, 'named-pipe-bridge');
  assert.equal(result.aida64Mode, 'auto-import-bridge');
  assert.equal(result.bridgeResponse, 'OK QUEUED');
  assert.equal(result.aida64BridgeResponse, 'OK APPLIED');
  assert.match(result.actions[1].path, /QGT_Matrix_Green\.ralcd$/);
  assert.deepEqual(result.actions.map((action) => action.state), ['Queued', 'Applied']);
});

test('AIDA64-only apply loads the AIO bridge without OpenRGB', async () => {
  const rgbCalls = [];
  const aida64Calls = [];
  const result = await applyTheme(
    'Matrix',
    { ENABLE_AIDA64_AIO_ACTIONS: 'true' },
    {
      bridgeClient: async (themeId) => {
        rgbCalls.push(themeId);
        return 'OK QUEUED';
      },
      aida64BridgeClient: async (themeId) => {
        aida64Calls.push(themeId);
        return 'OK APPLIED';
      },
    },
  );

  assert.deepEqual(rgbCalls, []);
  assert.deepEqual(aida64Calls, ['Matrix']);
  assert.equal(result.dryRun, false);
  assert.equal(result.openRgbMode, 'locked');
  assert.equal(result.aida64Mode, 'auto-import-bridge');
  assert.equal(result.aida64BridgeResponse, 'OK APPLIED');
  assert.equal(result.filesChanged, 0);
});

test('AIDA64 bridge queue-only response is not reported as applied', async () => {
  await assert.rejects(
    applyTheme('Matrix', { ENABLE_AIDA64_AIO_ACTIONS: 'true' }, {
      aida64BridgeClient: async () => 'OK QUEUED',
    }),
    (error) => error.code === 'AIDA64_BRIDGE_RESPONSE_ERROR'
      && error.failedStep === 'Send AIDA64 AIO bridge command',
  );
});

test('Theme Center exposes AIDA64 bridge readiness only after Owner Access unlock', async () => {
  const routes = new Map();
  const api = themeCenterApi({
    environment: { ENABLE_AIDA64_AIO_ACTIONS: 'true' },
    ownerAccess: { isAuthorized: (cookie) => cookie === 'owner=ok' },
    aida64BridgeReady: async () => true,
    getRuntimeStatus: async () => ({
      mode: 'lab',
      rgbActionsEnabled: true,
      aida64ActionsEnabled: true,
      labReady: true,
      rgbBridgeStatus: 'lab-ready',
    }),
  });
  api.configureServer({
    middlewares: {
      use: (path, handler) => routes.set(path, handler),
    },
  });

  const normalResponse = createJsonResponse();
  await routes.get('/api/theme-center/status')(
    { method: 'GET', headers: { cookie: '' } },
    normalResponse,
  );
  assert.equal(normalResponse.payload.aida64ActionsEnabled, false);
  assert.equal(normalResponse.payload.aida64BridgeStatus, 'locked');

  const ownerResponse = createJsonResponse();
  await routes.get('/api/theme-center/status')(
    { method: 'GET', headers: { cookie: 'owner=ok' } },
    ownerResponse,
  );
  assert.equal(ownerResponse.payload.aida64ActionsEnabled, true);
  assert.equal(ownerResponse.payload.aida64BridgeStatus, 'auto-import-ready');
});

test('invalid themes are rejected before any bridge connection', async () => {
  let connected = false;
  await assert.rejects(
    sendOpenRgbBridgeCommand('Unknown', {
      connect: () => {
        connected = true;
        return createBridgeSocket();
      },
    }),
    (error) => error.code === 'INVALID_THEME' && /Unknown theme/.test(error.message),
  );
  assert.equal(connected, false);
  assert.throws(() => getThemeCommand('constructor'), (error) => error.code === 'INVALID_THEME');
  assert.throws(() => getAida64LayoutPath('constructor'), (error) => error.code === 'INVALID_THEME');
  assert.throws(() => buildThemeDryRun(null), (error) => error.code === 'INVALID_THEME');
});

test('bridge unavailable returns a specific error without fallback', async () => {
  const socket = new EventEmitter();
  socket.setEncoding = () => {};
  socket.destroy = () => {};
  queueMicrotask(() => socket.emit('error', new Error('connect ENOENT')));

  await assert.rejects(
    sendOpenRgbBridgeCommand('Ice', { connect: () => socket }),
    (error) => error.code === 'BRIDGE_DISCONNECTED'
      && /bridge is unavailable/i.test(error.message),
  );
});

test('synchronous bridge connection failure is normalized safely', async () => {
  await assert.rejects(
    sendOpenRgbBridgeCommand('Matrix', {
      connect: () => {
        throw new Error('pipe unavailable');
      },
    }),
    (error) => error.code === 'BRIDGE_DISCONNECTED'
      && /pipe unavailable/.test(error.message),
  );
});

test('bridge invalid-theme response is surfaced as rejection', async () => {
  const socket = createBridgeSocket('ERROR INVALID_THEME');
  await assert.rejects(
    sendOpenRgbBridgeCommand('Stealth', { connect: () => socket }),
    (error) => error.code === 'INVALID_THEME'
      && /rejected theme Stealth/.test(error.message),
  );
});

test('unexpected bridge success text is rejected', async () => {
  await assert.rejects(
    applyTheme('PurpleBlue', { ENABLE_THEME_ACTIONS: 'true' }, {
      bridgeClient: async () => 'OK',
    }),
    (error) => error.code === 'BRIDGE_RESPONSE_ERROR'
      && error.failedStep === 'Send OpenRGB Effects bridge command',
  );
});

test('backend apply lock rejects overlap and releases afterward', async () => {
  const lock = createApplyLock();
  let release;
  const first = lock.run(() => new Promise((resolve) => {
    release = resolve;
  }));

  assert.equal(lock.locked, true);
  await assert.rejects(
    lock.run(async () => {}),
    (error) => error.code === 'APPLY_LOCKED',
  );

  release('done');
  assert.equal(await first, 'done');
  assert.equal(lock.locked, false);
  assert.equal(await lock.run(async () => 'next'), 'next');
});

test('UI apply guard blocks double clicks and debounces rapid repeats', () => {
  let time = 1_000;
  const guard = createThemeApplyGuard({
    debounceMs: 750,
    now: () => time,
  });

  assert.equal(guard.tryAcquire(), true);
  assert.equal(guard.tryAcquire(), false);
  guard.release();
  assert.equal(guard.tryAcquire(), false);
  time += 750;
  assert.equal(guard.tryAcquire(), true);
  guard.release();
});

test('UI formats exact backend failure steps', () => {
  assert.equal(
    formatThemeApplyError({
      failedStep: 'Send OpenRGB Effects bridge command',
      error: 'OpenRGB Effects bridge is unavailable.',
    }),
    'Failed at Send OpenRGB Effects bridge command: OpenRGB Effects bridge is unavailable.',
  );
});

test('locked theme appearance persists and Default restores Cipher cyan blue', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  storeThemeAppearance({
    themeId: 'Matrix',
    colors: ['#19ff70', '#b6ff23'],
    locked: true,
  }, storage);
  assert.deepEqual(readThemeAppearance(storage), {
    themeId: 'Matrix',
    colors: ['#19ff70', '#b6ff23'],
    locked: true,
  });

  assert.deepEqual(resetThemeAppearance(storage), {
    ...DEFAULT_THEME_APPEARANCE,
    colors: ['#24eaff', '#477bff'],
  });
  assert.equal(values.size, 0);
});

test('a locked appearance ignores later theme previews until unlocked', () => {
  const locked = {
    themeId: 'PurpleBlue',
    colors: ['#8b2cff', '#15dfff'],
    locked: true,
  };
  assert.deepEqual(previewThemeAppearance(locked, {
    id: 'Inferno',
    colors: ['#ff304f', '#ff8a18'],
  }), locked);
});
