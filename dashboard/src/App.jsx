import { useEffect, useState } from 'react';
import ModePanel from './components/ModePanel.jsx';
import ProjectPanel from './components/ProjectPanel.jsx';
import { HardwarePanel, TodayPanel } from './components/StatusPanel.jsx';
import SystemPanel from './components/SystemPanel.jsx';
import VoiceCenter from './components/panels/VoiceCenter.jsx';
import OperatorPanel from './components/modes/OperatorPanel.jsx';
import IntegrationsPanel from './components/integrations/IntegrationsPanel.jsx';
import CommandConsole from './components/console/CommandConsole.jsx';
import VersionTimeline from './components/panels/VersionTimeline.jsx';
import ThemeCenter from './components/themes/ThemeCenter.jsx';
import StartupGateway from './components/startup/StartupGateway.jsx';
import TemperatureAlert from './components/TemperatureAlert.jsx';
import { useVoice } from './hooks/useVoice.js';
import { useTelemetry } from './hooks/useTelemetry.js';
import { useTemperatureAlerts } from './hooks/useTemperatureAlerts.js';
import { operatorModes } from './data/operatorModes.js';
import { getIdentity } from './services/identity/identityService.js';
import {
  previewThemeAppearance,
  readThemeAppearance,
  resetThemeAppearance,
  storeThemeAppearance,
} from './services/themes/themeAppearance.js';
import {
  getAdminExecutionMode,
  getAdminModeAction,
  getExternalActionStatus,
  getOwnerAccessStatus,
  getRgbBridgeStatus,
  isOwnerAuthenticated,
  runAdminModeAction,
  unlockAdminOwnerAccess,
} from './services/startup/adminFooterAccess.js';
import {
  getStartupGatewayStatus,
  selectStartupMode,
  unlockOwnerAccess,
} from './services/startup/startupGatewayService.js';
import {
  getAuthorizedSectionView,
  getSectionNavigationItems,
} from './services/navigation/sectionNavigation.js';

const formatUptime = (seconds) => {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const remaining = String(seconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${remaining}`;
};

const cipherCompanion = Object.freeze({
  identityId: 'companion',
  agentName: 'Cipher',
});

export default function App() {
  const [startupGatewayOpen, setStartupGatewayOpen] = useState(true);
  const [startupStatus, setStartupStatus] = useState(null);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [view, setView] = useState('dashboard');
  const [mode, setMode] = useState('idle');
  const [now, setNow] = useState(new Date());
  const [operatorMode, setOperatorMode] = useState('work');
  const [themeAppearance, setThemeAppearance] = useState(readThemeAppearance);
  const sectionNavigationItems = getSectionNavigationItems(startupStatus);
  const telemetry = useTelemetry();
  const temperatureAlerts = useTemperatureAlerts(telemetry, {
    ownerUnlocked: Boolean(startupStatus?.ownerUnlocked),
  });
  const activeOperator = operatorModes.find((item) => item.id === operatorMode) ?? operatorModes[0];
  const activeIdentity = getIdentity(cipherCompanion.identityId);
  const handleCommandEffect = (effect) => {
    if (effect?.type === 'SET_OPERATOR_MODE') setOperatorMode(effect.value);
  };
  const handleCompanionStateChange = (nextMode) => setMode(nextMode);
  const handleThemeChange = (theme) => {
    setThemeAppearance((current) => {
      const next = previewThemeAppearance(current, theme);
      if (next.locked) storeThemeAppearance(next);
      return next;
    });
  };
  const handleThemeLockChange = (locked) => {
    setThemeAppearance((current) => {
      const next = { ...current, locked };
      storeThemeAppearance(next);
      return next;
    });
  };
  const handleThemeReset = () => {
    setThemeAppearance(resetThemeAppearance());
  };
  const updateStartupStatus = (nextStatus) => {
    setStartupStatus((current) => ({
      ...current,
      ...nextStatus,
      ownerUnlocked: nextStatus?.ownerUnlocked ?? current?.ownerUnlocked,
      ownerAccessAvailable: nextStatus?.ownerAccessAvailable ?? current?.ownerAccessAvailable,
    }));
  };
  const openAdminPanel = async () => {
    setAdminPanelOpen(true);
    setAdminError('');
    try {
      updateStartupStatus(await getStartupGatewayStatus());
    } catch (error) {
      setAdminError(error.message);
    }
  };
  const closeAdminPanel = () => {
    setAdminPanelOpen(false);
    setAdminPin('');
    setAdminError('');
  };
  const handleAdminUnlock = async (event) => {
    event.preventDefault();
    setAdminBusy(true);
    setAdminError('');
    try {
      updateStartupStatus(await unlockAdminOwnerAccess(adminPin, { unlockOwnerAccess }));
      setAdminPin('');
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminBusy(false);
    }
  };
  const handleAdminModeAction = async () => {
    setAdminBusy(true);
    setAdminError('');
    try {
      const result = await runAdminModeAction(startupStatus, { selectStartupMode });
      updateStartupStatus(result);
    } catch (error) {
      setAdminError(error.message);
      try {
        updateStartupStatus(await getStartupGatewayStatus());
      } catch {
        // Preserve the actionable mode-change error if a follow-up status check fails.
      }
    } finally {
      setAdminBusy(false);
    }
  };
  const {
    speech,
    progress,
    speak,
    listen,
    stop,
    voiceMode,
    voiceError,
  } = useVoice(handleCompanionStateChange);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setView((currentView) => getAuthorizedSectionView(currentView, startupStatus));
  }, [startupStatus]);

  return (
    <main
      className={`app mode-theme-${mode} operator-${operatorMode}`}
      style={{
        '--operator-accent': activeOperator.accent,
        '--identity-accent': activeIdentity.accent,
        '--identity-secondary': activeIdentity.secondary,
        '--cyan': themeAppearance.colors[0],
        '--theme-primary': themeAppearance.colors[0],
        '--theme-secondary': themeAppearance.colors[1],
        '--violet': themeAppearance.colors[1],
        '--line': `color-mix(in srgb, ${themeAppearance.colors[0]} 16%, transparent)`,
        '--core-panel-line': `color-mix(in srgb, ${themeAppearance.colors[0]} 14%, transparent)`,
        '--core-panel-blue': `color-mix(in srgb, ${themeAppearance.colors[0]} 10%, #050d1b)`,
        '--core-panel-violet': `color-mix(in srgb, ${themeAppearance.colors[1]} 12%, transparent)`,
      }}
    >
      <StartupGateway
        open={startupGatewayOpen}
        onClose={() => setStartupGatewayOpen(false)}
        onStatusChange={setStartupStatus}
      />
      <TemperatureAlert warning={temperatureAlerts.warning} />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <img src="/assets/branding/cipher-core-logo.png" alt="" draggable="false" />
        </div>
        <div className="brand">
          <p>CIPHER // LOCAL COMMAND SYSTEM</p>
          <h1>Cipher Core</h1>
        </div>
        <div className="header-status">
          <button
            type="button"
            className={`startup-mode-badge mode-${startupStatus?.mode ?? 'safe'}`}
            onClick={() => setStartupGatewayOpen(true)}
          >
            {(startupStatus?.mode ?? 'safe').toUpperCase()} MODE
          </button>
          <span className="local-badge"><i /> LOCAL ONLY</span>
          <div className="clock">
            <strong>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
            <small>{now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</small>
          </div>
          <span className="version">v0.9 <b>PRE-AWAKENING</b></span>
        </div>
      </header>

      <nav className="section-nav" aria-label="Cipher Core sections">
        {sectionNavigationItems.map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={view === id ? 'active' : ''}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
        <span>Cipher &middot; Companion</span>
      </nav>

      {view === 'dashboard' && (
        <>
          <div className="dashboard-grid">
            <aside className="column left-column">
              <SystemPanel
                telemetry={telemetry}
                themeColors={themeAppearance.colors}
                themeId={themeAppearance.themeId}
                ownerUnlocked={Boolean(startupStatus?.ownerUnlocked)}
                temperatureThreshold={temperatureAlerts.threshold}
                onTemperatureThresholdChange={temperatureAlerts.setThreshold}
              />
              <ProjectPanel />
              <OperatorPanel activeMode={operatorMode} onChange={setOperatorMode} />
            </aside>

            <section className="core-column">
              <div className="core-kicker"><span /> CIPHER NEURAL INTERFACE <span /></div>
              <ModePanel activeMode={mode} onChange={setMode} />
            </section>

            <aside className="column right-column">
              <VoiceCenter
                speech={speech}
                progress={progress}
                onListen={listen}
                onStop={stop}
                voiceMode={voiceMode}
                error={voiceError}
              />
              <TodayPanel />
              <HardwarePanel />
            </aside>
          </div>

          <section className="lower-deck">
            <div className="lower-stack">
              <CommandConsole onEffect={handleCommandEffect} />
              <VersionTimeline />
            </div>
            <IntegrationsPanel />
          </section>
        </>
      )}

      {view === 'theme-center' && (
        <ThemeCenter
          startupStatus={startupStatus}
          activeAppearanceTheme={themeAppearance.themeId}
          appearanceLocked={themeAppearance.locked}
          adminMode={Boolean(startupStatus?.ownerUnlocked)}
          onThemeChange={handleThemeChange}
          onAppearanceLockChange={handleThemeLockChange}
          onAppearanceReset={handleThemeReset}
        />
      )}

      <footer className="app-footer">
        <span><i /> CORE ONLINE</span>
        <p>LOCAL-FIRST SYSTEM <b>&bull;</b> CIPHER VISION ACTIVE <b>&bull;</b> HARDWARE CONTROL DISABLED</p>
        <button type="button" className="footer-admin" onClick={openAdminPanel}>ADMIN</button>
        <small>CIPHER CORE // LOCAL COMMAND SYSTEM</small>
      </footer>

      {adminPanelOpen && (
        <section
          className="admin-access-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-access-title"
        >
          <div className="admin-access-panel">
            <header>
              <span>OWNER CONTROL</span>
              <h2 id="admin-access-title">ADMIN</h2>
            </header>

            {!isOwnerAuthenticated(startupStatus) ? (
              <form className="admin-owner-form" onSubmit={handleAdminUnlock}>
                <label htmlFor="admin-owner-pin">Owner Access</label>
                <input
                  id="admin-owner-pin"
                  type="password"
                  value={adminPin}
                  onChange={(event) => setAdminPin(event.target.value)}
                  autoComplete="current-password"
                  placeholder="OWNER PIN"
                  disabled={adminBusy}
                />
                <button type="submit" disabled={adminBusy || !adminPin}>
                  {adminBusy ? 'VERIFYING' : 'UNLOCK'}
                </button>
              </form>
            ) : (
              <>
                <dl className="admin-status-grid">
                  <div>
                    <dt>Execution Mode</dt>
                    <dd>{getAdminExecutionMode(startupStatus)}</dd>
                  </div>
                  <div>
                    <dt>Owner Access</dt>
                    <dd>{getOwnerAccessStatus(startupStatus)}</dd>
                  </div>
                  <div>
                    <dt>RGB Bridge</dt>
                    <dd>{getRgbBridgeStatus(startupStatus)}</dd>
                  </div>
                  <div>
                    <dt>External Actions</dt>
                    <dd>{getExternalActionStatus(startupStatus)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="admin-mode-action"
                  disabled={adminBusy}
                  onClick={handleAdminModeAction}
                >
                  {adminBusy ? 'WORKING' : getAdminModeAction(startupStatus).label}
                </button>
              </>
            )}

            {adminError && <p className="admin-access-error" role="alert">{adminError}</p>}

            <button type="button" className="admin-close" onClick={closeAdminPanel}>
              CLOSE
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
