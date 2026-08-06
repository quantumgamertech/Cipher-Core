import { useEffect, useRef, useState } from 'react';
import { themes } from '../../data/themes.js';
import {
  applyTheme,
  createThemeApplyGuard,
  getThemeCenterStatus,
} from '../../services/themes/themeCenterService.js';

const STATUS_COPY = {
  Ready: 'Select a theme to preview its local activation plan.',
  Applying: 'Applying selected theme state...',
  Applied: 'Theme applied through available local bridges.',
  'Preview Applied': 'Theme preview applied. External actions remain locked.',
  Error: 'The selected theme could not be applied.',
};

export default function ThemeCenter({
  startupStatus = null,
  activeAppearanceTheme = 'Default',
  appearanceLocked = false,
  adminMode = false,
  onThemeChange,
  onAppearanceLockChange,
  onAppearanceReset,
}) {
  const [status, setStatus] = useState('Ready');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [realActionsEnabled, setRealActionsEnabled] = useState(false);
  const [aida64ActionsEnabled, setAida64ActionsEnabled] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState('safe');
  const [rgbBridgeStatus, setRgbBridgeStatus] = useState('offline');
  const [aida64BridgeStatus, setAida64BridgeStatus] = useState('locked');
  const [independentAioTheme, setIndependentAioTheme] = useState(null);
  const [runtimeMessage, setRuntimeMessage] = useState('');
  const applyGuard = useRef(createThemeApplyGuard());
  const aioThemes = [
    {
      id: 'Default',
      name: 'Default',
      colors: ['#24eaff', '#477bff'],
      aidaLayout: 'Permanent_Master/QGT_Inferno_RedOrange.ralcd',
    },
    ...themes,
  ];

  useEffect(() => {
    let active = true;
    getThemeCenterStatus()
      .then((result) => {
        if (active) {
          setRealActionsEnabled(result.realActionsEnabled);
          setAida64ActionsEnabled(result.aida64ActionsEnabled);
          setRuntimeMode(result.mode ?? 'safe');
          setRgbBridgeStatus(result.rgbBridgeStatus ?? 'offline');
          setAida64BridgeStatus(result.aida64BridgeStatus ?? 'locked');
          setRuntimeMessage(result.message ?? '');
        }
      })
      .catch((statusError) => {
        if (active) {
          setError(statusError.message);
          setStatus('Error');
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (startupStatus) {
      setRealActionsEnabled(Boolean(startupStatus.rgbActionsEnabled));
      setRuntimeMode(startupStatus.mode ?? 'safe');
      setRgbBridgeStatus(startupStatus.rgbBridgeStatus ?? 'offline');
      setAida64BridgeStatus(startupStatus.aida64BridgeStatus ?? 'locked');
      setRuntimeMessage(startupStatus.message ?? '');
    }
  }, [startupStatus]);

  const handleApply = async (theme) => {
    if (!applyGuard.current.tryAcquire()) return;
    setStatus('Applying');
    setSelectedTheme(theme.id);
    setPlan(null);
    setError('');

    try {
      const result = await applyTheme(theme.id);
      setRealActionsEnabled(result.realActionsEnabled);
      setAida64ActionsEnabled(result.aida64ActionsEnabled);
      setPlan(result);
      setStatus(result.dryRun ? 'Preview Applied' : 'Applied');
      setAida64BridgeStatus(result.aida64ActionsEnabled ? 'manual-assist-ready' : 'locked');
      onThemeChange?.(theme);
      if (!appearanceLocked) setIndependentAioTheme(null);
    } catch (requestError) {
      setError(requestError.message);
      setStatus('Error');
      getThemeCenterStatus()
        .then((result) => {
          setRealActionsEnabled(result.realActionsEnabled);
          setRuntimeMode(result.mode ?? 'safe');
          setRgbBridgeStatus(result.rgbBridgeStatus ?? 'offline');
          setAida64BridgeStatus(result.aida64BridgeStatus ?? 'locked');
          setRuntimeMessage(result.message ?? '');
        })
        .catch(() => {});
    } finally {
      applyGuard.current.release();
    }
  };

  const bridgeCopy = {
    'lab-ready': {
      title: 'LAB READY',
      detail: 'RGB Bridge Online',
    },
    starting: {
      title: 'LAB OPENRGB STARTING',
      detail: 'Waiting for port 6743 and bridge command readiness',
    },
    'production-conflict': {
      title: 'PRODUCTION OPENRGB CONFLICT',
      detail: 'Production OpenRGB is active',
    },
    offline: {
      title: runtimeMode === 'lab'
        ? 'RGB BRIDGE OFFLINE'
        : runtimeMode === 'live'
          ? 'LIVE MODE'
          : 'SAFE MODE',
      detail: runtimeMode === 'lab'
        ? 'RGB Bridge Offline'
        : runtimeMode === 'live'
          ? 'External RGB actions are locked'
          : 'Real system actions are locked',
    },
  }[rgbBridgeStatus] ?? {
    title: 'RGB BRIDGE OFFLINE',
    detail: 'RGB Bridge Offline',
  };
  const statusCopy = status === 'Preview Applied' && runtimeMode === 'safe'
    ? 'Preview only. No external actions were performed.'
    : STATUS_COPY[status];
  const actionLabel = realActionsEnabled
    ? aida64ActionsEnabled ? 'RGB + AIO' : 'OpenRGB'
    : aida64ActionsEnabled
      ? 'AIO only'
    : runtimeMode === 'live'
      ? 'RGB locked'
      : 'Preview only';
  const activeThemeId = selectedTheme ?? activeAppearanceTheme;
  const activeAioThemeId = appearanceLocked
    ? independentAioTheme ?? activeThemeId
    : activeThemeId;
  const selectedAioTheme = aioThemes.find((theme) => theme.id === activeAioThemeId)
    ?? aioThemes[0];

  const handleAioApply = async (theme) => {
    if (!appearanceLocked || !aida64ActionsEnabled || !applyGuard.current.tryAcquire()) return;
    setStatus('Applying');
    setPlan(null);
    setError('');

    try {
      const result = await applyTheme(theme.id, { target: 'aida64' });
      setPlan(result);
      setIndependentAioTheme(theme.id);
      setStatus(result.dryRun ? 'Preview Applied' : 'Applied');
    } catch (requestError) {
      setError(requestError.message);
      setStatus('Error');
    } finally {
      applyGuard.current.release();
    }
  };

  const handleDefaultAppearance = async () => {
    if (!applyGuard.current.tryAcquire()) return;
    setStatus('Applying');
    setSelectedTheme('Default');
    setPlan(null);
    setError('');

    try {
      const result = await applyTheme('Default');
      setRealActionsEnabled(result.realActionsEnabled);
      setAida64ActionsEnabled(result.aida64ActionsEnabled);
      setPlan(result);
      setStatus(result.dryRun ? 'Preview Applied' : 'Applied');
      setIndependentAioTheme(null);
      onAppearanceReset?.();
    } catch (requestError) {
      setError(requestError.message);
      setStatus('Error');
    } finally {
      applyGuard.current.release();
    }
  };

  return (
    <section className="theme-center-view" aria-labelledby="theme-center-title">
      <header className="theme-center-hero">
        <div>
          <p>LOCAL APPEARANCE ORCHESTRATION</p>
          <h2 id="theme-center-title">Theme Center</h2>
          <span>One command surface for lighting, LCD, desktop, and future controls.</span>
        </div>
        <div className="theme-safety-lock">
          <small>EXECUTION MODE</small>
          <strong>{bridgeCopy.title}</strong>
          <span>{bridgeCopy.detail}</span>
          {runtimeMessage && <em>{runtimeMessage}</em>}
        </div>
      </header>

      <div className="theme-status-panel" data-status={status.toLowerCase()}>
        <span className="theme-status-pip" />
        <div>
          <small>THEME ENGINE STATUS</small>
          <strong>{status}</strong>
          <p>{error || statusCopy}</p>
        </div>
        <div className="theme-appearance-controls">
          <button
            type="button"
            className={appearanceLocked ? 'locked' : ''}
            aria-pressed={appearanceLocked}
            onClick={() => onAppearanceLockChange?.(!appearanceLocked)}
          >
            {appearanceLocked ? 'Colors Locked' : 'Lock Colors'}
          </button>
          <button type="button" onClick={handleDefaultAppearance}>Default</button>
        </div>
      </div>

      <div className="theme-card-grid">
        {themes.map((theme) => (
          <article
            className={`theme-card ${activeThemeId === theme.id ? 'selected' : ''}`}
            key={theme.id}
            style={{
              '--theme-primary': theme.colors[0],
              '--theme-secondary': theme.colors[1],
            }}
          >
            <div className="theme-card-visual" aria-hidden="true">
              <i />
              <i />
              <span />
            </div>
            <div className="theme-card-copy">
              <small>QGT SYSTEM THEME</small>
              <h3>{theme.name}</h3>
              <p>{theme.style}</p>
            </div>
            <div className="theme-capabilities">
              <span>OpenRGB</span>
              <span className={aida64ActionsEnabled ? '' : 'planned'}>
                {aida64ActionsEnabled ? 'Ryujin LCD' : 'Ryujin LCD skipped'}
              </span>
              <span className="planned">{adminMode ? 'Wallpaper' : 'Wallpaper'}</span>
              <span className="planned">{adminMode ? 'Windows' : 'Windows'}</span>
            </div>
            <button
              type="button"
              onClick={() => handleApply(theme)}
              disabled={status === 'Applying'}
            >
              {status === 'Applying' && selectedTheme === theme.id ? 'Applying…' : 'Apply'}
              <small>{actionLabel}</small>
            </button>
          </article>
        ))}
      </div>

      <section className="theme-aio-panel panel">
        <div className="panel-heading">
          <span>AIO DISPLAY</span>
          <small>{aida64ActionsEnabled ? 'AUTO BRIDGE' : 'LOCKED'}</small>
        </div>
        <div className="theme-aio-content">
          <div>
            <small>ROG AIO 320 x 240</small>
            <strong>{selectedAioTheme.name}</strong>
            <p>
              {aida64ActionsEnabled
                ? `${selectedAioTheme.aidaLayout} follows the selected theme.`
                : 'AIDA64 remains locked until a verified visible-switch bridge is available.'}
            </p>
          </div>
          <ol>
            {aioThemes.map((theme) => (
              <li className={activeAioThemeId === theme.id ? 'selected' : ''} key={theme.id}>
                <button
                  type="button"
                  disabled={!appearanceLocked || !aida64ActionsEnabled || status === 'Applying'}
                  onClick={() => handleAioApply(theme)}
                  aria-pressed={activeAioThemeId === theme.id}
                  style={{
                    '--theme-primary': theme.colors[0],
                    '--theme-secondary': theme.colors[1],
                  }}
                >
                  <span />
                  <div>
                    <strong>{theme.name}</strong>
                    <code>{theme.aidaLayout}</code>
                  </div>
                </button>
              </li>
            ))}
          </ol>
          <b>{aida64BridgeStatus}</b>
        </div>
      </section>

      <section className="theme-action-log panel">
        <div className="panel-heading">
          <span>ACTION LOG</span>
          <small>{plan ? `${plan.themeId.toUpperCase()} ${plan.dryRun ? 'PREVIEW' : 'APPLIED'}` : 'AWAITING THEME'}</small>
        </div>
        {!plan && <p className="theme-log-empty">No theme apply has been requested.</p>}
        {plan && (
          <>
            <div className="theme-log-meta">
              <span>Real actions <b>{plan.dryRun ? 'Disabled' : 'Enabled'}</b></span>
              <span>Files changed <b>{plan.filesChanged}</b></span>
              <span>Generated <b>{new Date(plan.generatedAt).toLocaleTimeString()}</b></span>
            </div>
            <ol>
              {plan.actions.map((action) => (
                <li key={action.id} className={action.available ? '' : 'unavailable'}>
                  <span>{String(action.order).padStart(2, '0')}</span>
                  <div>
                    <strong>{action.label}</strong>
                    <p>{action.message}</p>
                    <code>{action.path}</code>
                  </div>
                  <b>{action.state ?? (action.skipped ? 'Skipped' : action.available ? 'Ready' : 'Missing')}</b>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </section>
  );
}
