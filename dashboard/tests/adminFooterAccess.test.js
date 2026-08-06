import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getAdminExecutionMode,
  getAdminModeAction,
  getExternalActionStatus,
  getOwnerAccessStatus,
  getRgbBridgeStatus,
  isOwnerAuthenticated,
  runAdminModeAction,
  unlockAdminOwnerAccess,
} from '../src/services/startup/adminFooterAccess.js';

const appSource = () => readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const stylesSource = () => readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('ADMIN appears in the footer before the existing local command branding', () => {
  const source = appSource();
  const footerIndex = source.indexOf('<footer className="app-footer">');
  const adminIndex = source.indexOf('className="footer-admin"');
  const brandingIndex = source.indexOf('CIPHER CORE // LOCAL COMMAND SYSTEM', footerIndex);

  assert.notEqual(footerIndex, -1);
  assert.notEqual(adminIndex, -1);
  assert.notEqual(brandingIndex, -1);
  assert.ok(adminIndex > footerIndex);
  assert.ok(adminIndex < brandingIndex);
  assert.match(source.slice(adminIndex, brandingIndex), />ADMIN</);
});

test('unauthenticated ADMIN access uses the existing Owner Access unlock function', async () => {
  let receivedPin = '';
  const result = await unlockAdminOwnerAccess('2468', {
    unlockOwnerAccess: async (pin) => {
      receivedPin = pin;
      return { ownerUnlocked: true, mode: 'live' };
    },
  });

  assert.equal(receivedPin, '2468');
  assert.equal(result.ownerUnlocked, true);
});

test('authenticated owner can enter Lab Mode through the existing mode selector', async () => {
  let selectedMode = '';
  const result = await runAdminModeAction(
    { mode: 'live', ownerUnlocked: true, rgbActionsEnabled: false },
    {
      selectStartupMode: async (mode) => {
        selectedMode = mode;
        return { mode, rgbActionsEnabled: true, rgbBridgeStatus: 'lab-ready' };
      },
    },
  );

  assert.equal(selectedMode, 'lab');
  assert.equal(result.mode, 'lab');
});

test('owner can return to Live Mode through the existing mode selector', async () => {
  let selectedMode = '';
  const result = await runAdminModeAction(
    { mode: 'lab', ownerUnlocked: true, rgbActionsEnabled: true },
    {
      selectStartupMode: async (mode) => {
        selectedMode = mode;
        return { mode, rgbActionsEnabled: false, rgbBridgeStatus: 'offline' };
      },
    },
  );

  assert.equal(selectedMode, 'live');
  assert.equal(result.mode, 'live');
  assert.equal(result.rgbActionsEnabled, false);
});

test('Live Mode still reports external RGB actions as locked', () => {
  const status = {
    mode: 'live',
    ownerUnlocked: true,
    rgbActionsEnabled: false,
    rgbBridgeStatus: 'offline',
  };

  assert.equal(isOwnerAuthenticated(status), true);
  assert.equal(getAdminExecutionMode(status), 'Live Mode');
  assert.equal(getOwnerAccessStatus(status), 'OWNER ACCESS UNLOCKED');
  assert.equal(getRgbBridgeStatus(status), 'OFFLINE');
  assert.equal(getExternalActionStatus(status), 'EXTERNAL ACTIONS LOCKED');
  assert.deepEqual(getAdminModeAction(status), { label: 'ENTER LAB MODE', mode: 'lab' });
});

test('footer dimensions remain unchanged by the ADMIN entry', () => {
  const styles = stylesSource();
  const footerRule = styles.match(/footer \{ position: relative;[^}]+\}/)?.[0] ?? '';
  const adminRule = styles.match(/\.footer-admin \{[^}]+\}/)?.[0] ?? '';

  assert.match(footerRule, /min-height:\s*30px;/);
  assert.match(footerRule, /padding:\s*9px 4px 0;/);
  assert.match(adminRule, /height:\s*18px;/);
});
