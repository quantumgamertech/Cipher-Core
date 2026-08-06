import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAuthorizedSectionView,
  getSectionNavigationItems,
  SECTION_VIEWS,
} from '../src/services/navigation/sectionNavigation.js';

test('client navigation shows only Command Center and Theme Center', () => {
  const items = getSectionNavigationItems({ mode: 'live', ownerUnlocked: false });

  assert.deepEqual(items, [
    [SECTION_VIEWS.DASHBOARD, 'Command Center'],
    [SECTION_VIEWS.THEME_CENTER, 'Theme Center'],
  ]);
});

test('owner navigation still shows only Command Center and Theme Center', () => {
  const items = getSectionNavigationItems({ mode: 'live', ownerUnlocked: true });

  assert.deepEqual(items, [
    [SECTION_VIEWS.DASHBOARD, 'Command Center'],
    [SECTION_VIEWS.THEME_CENTER, 'Theme Center'],
  ]);
});

test('Lab Mode no longer exposes retired internal navigation', () => {
  const items = getSectionNavigationItems({ mode: 'lab', ownerUnlocked: false });

  assert.deepEqual(items, [
    [SECTION_VIEWS.DASHBOARD, 'Command Center'],
    [SECTION_VIEWS.THEME_CENTER, 'Theme Center'],
  ]);
});

test('Lab Mode with Owner Access still keeps retired internal navigation hidden', () => {
  const items = getSectionNavigationItems({ mode: 'lab', ownerUnlocked: true });

  assert.deepEqual(items, [
    [SECTION_VIEWS.DASHBOARD, 'Command Center'],
    [SECTION_VIEWS.THEME_CENTER, 'Theme Center'],
  ]);
});

test('client navigation still shows Command Center and Theme Center in order', () => {
  const labels = getSectionNavigationItems({ mode: 'live', ownerUnlocked: true })
    .map(([, label]) => label);

  assert.deepEqual(labels, ['Command Center', 'Theme Center']);
});

test('retired internal view redirects to Command Center', () => {
  assert.equal(
    getAuthorizedSectionView('presence', { mode: 'live', ownerUnlocked: true }),
    SECTION_VIEWS.DASHBOARD,
  );
  assert.equal(
    getAuthorizedSectionView('presence', { mode: 'lab', ownerUnlocked: true }),
    SECTION_VIEWS.DASHBOARD,
  );
});
