import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  classifyOpenRgbConflict,
  createOwnerAccess,
  createStartupGateway,
  LAB_OPENRGB,
  probeOpenRgbBridge,
  STARTUP_MODES,
} from '../server/startupGateway.js';

const emptyInventory = () => ({ processes: [], ports: [] });
const validDependencies = (overrides = {}) => {
  let inspectionCount = 0;
  return {
  inspectRuntime: async () => {
    inspectionCount += 1;
    return inspectionCount === 1
      ? emptyInventory()
      : {
        processes: [{ processId: 1234, executablePath: null }],
        ports: [{ port: 6743, processId: 1234 }],
      };
  },
  pathExists: () => true,
  hashFile: async () => LAB_OPENRGB.bridgeSha256,
  stopOpenRgb: async () => {},
  launchLab: async () => 1234,
  portCheck: async () => true,
  bridgeCheck: async () => true,
  readinessTimeoutMs: 20,
  ...overrides,
  };
};

test('Startup Gateway always begins unselected in Safe Mode', () => {
  const gateway = createStartupGateway(validDependencies());
  assert.deepEqual(gateway.status(), {
    selected: false,
    mode: STARTUP_MODES.SAFE,
    rgbActionsEnabled: false,
    labReady: false,
    rgbBridgeStatus: 'offline',
    message: 'Select a startup mode.',
    selectionInFlight: false,
  });
});

test('Safe Mode enables no RGB actions and performs no OpenRGB inspection or launch', async () => {
  let externalCalls = 0;
  const gateway = createStartupGateway(validDependencies({
    inspectRuntime: async () => {
      externalCalls += 1;
      return emptyInventory();
    },
    launchLab: async () => {
      externalCalls += 1;
    },
  }));

  const status = await gateway.selectMode(STARTUP_MODES.SAFE);
  assert.equal(status.mode, STARTUP_MODES.SAFE);
  assert.equal(status.rgbActionsEnabled, false);
  assert.equal(externalCalls, 0);
});

test('Lab Mode is rejected before runtime inspection without an owner session', async () => {
  let inspected = false;
  const gateway = createStartupGateway(validDependencies({
    inspectRuntime: async () => {
      inspected = true;
      return emptyInventory();
    },
  }));

  await assert.rejects(
    gateway.selectMode(STARTUP_MODES.LAB),
    (error) => error.code === 'OWNER_ACCESS_REQUIRED',
  );
  assert.equal(inspected, false);
  assert.equal(gateway.status().rgbActionsEnabled, false);
});

test('Owner PIN unlock creates a server-memory browser session', () => {
  const access = createOwnerAccess({
    environment: { CIPHER_OWNER_PIN: '2468' },
    tokenFactory: () => 'session-token',
  });

  assert.equal(access.available, true);
  assert.throws(
    () => access.unlock('0000'),
    (error) => error.code === 'INVALID_OWNER_PIN',
  );
  const token = access.unlock('2468');
  const cookie = access.sessionCookie(token);
  assert.doesNotMatch(cookie, /2468/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.equal(access.isAuthorized('CipherOwnerSession=session-token'), true);
  assert.equal(access.isAuthorized(''), false);
});

test('missing Owner PIN keeps Owner Access unavailable', () => {
  const access = createOwnerAccess({ environment: {} });
  assert.equal(access.available, false);
  assert.throws(
    () => access.unlock('anything'),
    (error) => error.code === 'OWNER_ACCESS_UNAVAILABLE',
  );
});

test('Live Mode is selectable for daily use without inspecting or launching OpenRGB', async () => {
  let externalCalls = 0;
  const gateway = createStartupGateway(validDependencies({
    inspectRuntime: async () => {
      externalCalls += 1;
      return emptyInventory();
    },
    launchLab: async () => {
      externalCalls += 1;
    },
  }));

  const status = await gateway.selectMode(STARTUP_MODES.LIVE);
  assert.equal(status.selected, true);
  assert.equal(status.mode, STARTUP_MODES.LIVE);
  assert.equal(status.rgbActionsEnabled, false);
  assert.equal(status.labReady, false);
  assert.equal(status.rgbBridgeStatus, 'offline');
  assert.equal(externalCalls, 0);
});

test('production OpenRGB or port 6742 is classified as a Lab conflict', () => {
  assert.equal(classifyOpenRgbConflict({
    processes: [{
      executablePath: String.raw`C:\Program Files\OpenRGB\OpenRGB.exe`,
    }],
    ports: [],
  }).productionActive, true);
  assert.equal(classifyOpenRgbConflict({
    processes: [],
    ports: [{ port: 6742, processId: 12 }],
  }).productionActive, true);
});

test('elevated Lab OpenRGB on the bridge port is not classified as a restart conflict', () => {
  const result = classifyOpenRgbConflict({
    processes: [{
      processId: 4321,
      executablePath: null,
      integrityLevel: 'high',
      elevated: true,
    }],
    ports: [{ port: 6743, processId: 4321 }],
  });

  assert.equal(result.productionActive, false);
  assert.equal(result.labActive, true);
});

test('non-elevated Lab OpenRGB on the bridge port is classified for replacement', () => {
  const result = classifyOpenRgbConflict({
    processes: [{
      processId: 4321,
      executablePath: LAB_OPENRGB.executable,
      integrityLevel: 'medium',
      elevated: false,
    }],
    ports: [{ port: 6743, processId: 4321 }],
  });

  assert.equal(result.productionActive, true);
  assert.equal(result.labActive, true);
});

test('Lab Mode closes conflicting production OpenRGB before launching the lab runtime', async () => {
  const calls = [];
  let inspections = 0;
  const gateway = createStartupGateway(validDependencies({
    inspectRuntime: async () => {
      calls.push('inspect');
      inspections += 1;
      if (inspections === 1) {
        return {
          processes: [{
            processId: 22,
            executablePath: String.raw`C:\Program Files\OpenRGB\OpenRGB.exe`,
          }],
          ports: [{ port: 6742, processId: 22 }],
        };
      }
      if (inspections === 2) return emptyInventory();
      return {
        processes: [{ processId: 1234, executablePath: null }],
        ports: [{ port: 6743, processId: 1234 }],
      };
    },
    stopOpenRgb: async () => {
      calls.push('stop-production');
    },
    launchLab: async () => {
      calls.push('launch-lab');
      return 1234;
    },
  }));

  const result = await gateway.selectMode(STARTUP_MODES.LAB, { ownerAuthorized: true });
  assert.deepEqual(calls, ['inspect', 'stop-production', 'inspect', 'launch-lab', 'inspect']);
  assert.equal(result.rgbActionsEnabled, true);
});

test('Lab Mode remains fail-closed when production OpenRGB cannot be released', async () => {
  let launched = false;
  const conflict = {
    processes: [{
      processId: 22,
      executablePath: String.raw`C:\Program Files\OpenRGB\OpenRGB.exe`,
    }],
    ports: [{ port: 6742, processId: 22 }],
  };
  const gateway = createStartupGateway(validDependencies({
    inspectRuntime: async () => conflict,
    stopOpenRgb: async () => {},
    launchLab: async () => {
      launched = true;
    },
  }));

  await assert.rejects(
    gateway.selectMode(STARTUP_MODES.LAB, { ownerAuthorized: true }),
    (error) => error.code === 'PRODUCTION_OPENRGB_ACTIVE',
  );
  assert.equal(launched, false);
});

test('Lab Mode hides raw shutdown errors when elevated OpenRGB cannot be closed', async () => {
  const conflict = {
    processes: [{
      processId: 22,
      executablePath: String.raw`C:\Program Files\OpenRGB\OpenRGB.exe`,
    }],
    ports: [{ port: 6742, processId: 22 }],
  };
  const gateway = createStartupGateway(validDependencies({
    inspectRuntime: async () => conflict,
    stopOpenRgb: async () => {
      throw new Error('Stop-Process access denied raw PowerShell detail');
    },
  }));

  await assert.rejects(
    gateway.selectMode(STARTUP_MODES.LAB, { ownerAuthorized: true }),
    (error) => error.code === 'PRODUCTION_OPENRGB_ACTIVE'
      && error.message === 'Administrator approval is required to close production OpenRGB.'
      && !error.message.includes('PowerShell'),
  );
});

test('Lab Mode rejects a bridge DLL that differs from the validated hash', async () => {
  const gateway = createStartupGateway(validDependencies({
    hashFile: async () => 'BADHASH',
  }));
  await assert.rejects(
    gateway.selectMode(STARTUP_MODES.LAB, { ownerAuthorized: true }),
    (error) => error.code === 'LAB_BRIDGE_HASH_MISMATCH',
  );
  assert.equal(gateway.status().rgbActionsEnabled, false);
});

test('Lab Mode launches once and arms RGB only after port and pipe validation', async () => {
  const calls = [];
  let inspectionCount = 0;
  const gateway = createStartupGateway(validDependencies({
    inspectRuntime: async () => {
      calls.push('inspect');
      inspectionCount += 1;
      return inspectionCount === 1
        ? emptyInventory()
        : {
          processes: [{ processId: 1234, executablePath: null }],
          ports: [{ port: 6743, processId: 1234 }],
        };
    },
    hashFile: async () => {
      calls.push('hash');
      return LAB_OPENRGB.bridgeSha256;
    },
    launchLab: async () => {
      calls.push('launch');
      return 1234;
    },
    portCheck: async () => {
      calls.push('port');
      return true;
    },
    bridgeCheck: async () => {
      calls.push('pipe');
      return true;
    },
  }));

  const status = await gateway.selectMode(STARTUP_MODES.LAB, { ownerAuthorized: true });
  assert.deepEqual(calls, ['inspect', 'hash', 'launch', 'inspect', 'port', 'pipe']);
  assert.equal(status.mode, STARTUP_MODES.LAB);
  assert.equal(status.labReady, true);
  assert.equal(status.rgbActionsEnabled, true);
});

test('an already elevated validated Lab listener is reused without launching another process', async () => {
  let launches = 0;
  const gateway = createStartupGateway(validDependencies({
    inspectRuntime: async () => ({
      processes: [{
        processId: 4321,
        executablePath: LAB_OPENRGB.executable,
        integrityLevel: 'high',
        elevated: true,
      }],
      ports: [{ port: 6743, processId: 4321 }],
    }),
    launchLab: async () => {
      launches += 1;
    },
  }));

  const status = await gateway.selectMode(STARTUP_MODES.LAB, { ownerAuthorized: true });
  assert.equal(status.rgbActionsEnabled, true);
  assert.equal(launches, 0);
});

test('non-elevated Lab OpenRGB is replaced by one elevated Lab process', async () => {
  const calls = [];
  let inspections = 0;
  const gateway = createStartupGateway(validDependencies({
    inspectRuntime: async () => {
      calls.push('inspect');
      inspections += 1;
      if (inspections === 1) {
        return {
          processes: [{
            processId: 4321,
            executablePath: LAB_OPENRGB.executable,
            integrityLevel: 'medium',
            elevated: false,
          }],
          ports: [{ port: 6743, processId: 4321 }],
        };
      }
      if (inspections === 2) return emptyInventory();
      return {
        processes: [{
          processId: 9876,
          executablePath: LAB_OPENRGB.executable,
          integrityLevel: 'high',
          elevated: true,
        }],
        ports: [{ port: 6743, processId: 9876 }],
      };
    },
    stopOpenRgb: async () => {
      calls.push('stop-openrgb');
    },
    launchLab: async () => {
      calls.push('launch-lab');
      return 9876;
    },
  }));

  const status = await gateway.selectMode(STARTUP_MODES.LAB, { ownerAuthorized: true });
  assert.deepEqual(calls, ['inspect', 'stop-openrgb', 'inspect', 'launch-lab', 'inspect']);
  assert.equal(status.rgbActionsEnabled, true);
});

test('bridge readiness requires a complete command response, not connection alone', async () => {
  const socket = new EventEmitter();
  socket.setEncoding = () => {};
  socket.destroy = () => {};
  socket.write = (command) => {
    socket.command = command;
    queueMicrotask(() => socket.emit('data', 'ERROR INVALID_THEME\n'));
  };
  queueMicrotask(() => socket.emit('connect'));

  const ready = await probeOpenRgbBridge(LAB_OPENRGB.pipe, {
    connect: () => socket,
    timeoutMs: 50,
  });
  assert.equal(socket.command, 'LOAD __CIPHER_HEALTHCHECK__\n');
  assert.equal(ready, true);
});

test('runtime health loss revokes Lab RGB authorization', async () => {
  let bridgeChecks = 0;
  const gateway = createStartupGateway(validDependencies({
    bridgeCheck: async () => {
      bridgeChecks += 1;
      return bridgeChecks === 1;
    },
  }));

  const ready = await gateway.selectMode(STARTUP_MODES.LAB, { ownerAuthorized: true });
  assert.equal(ready.rgbActionsEnabled, true);
  const unhealthy = await gateway.checkRgbHealth();
  assert.equal(unhealthy.rgbActionsEnabled, false);
  assert.equal(unhealthy.labReady, false);
  assert.equal(unhealthy.rgbBridgeStatus, 'offline');
});
