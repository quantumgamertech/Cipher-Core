import { useEffect, useState } from 'react';
import {
  selectStartupMode,
  STARTUP_ACTIVATION_MODE,
} from '../../services/startup/startupGatewayService.js';
import {
  runStartupInitialization,
  getStartupReadyDelay,
  STARTUP_READY_HOLD_MS,
  STARTUP_EVENTS,
  startupEvents,
} from '../../services/startup/startupExperience.js';
import { getStartupCompanionWakeTimeline } from '../../services/startup/startupCompanionLifecycle.js';

const titleLetters = ['C', 'I', 'P', 'H', 'E', 'R', ' ', 'C', 'O', 'R', 'E'];

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export default function StartupGateway({
  open,
  onClose,
  onStatusChange,
}) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [initializationReady, setInitializationReady] = useState(false);
  const [companionWakeComplete, setCompanionWakeComplete] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [activationPending, setActivationPending] = useState(false);

  useEffect(() => {
    let active = true;
    let readyTimer = null;
    let completionTimer = null;
    const bootStartedAt = Date.now();
    startupEvents.emit(STARTUP_EVENTS.ON_BOOT_BEGIN);

    runStartupInitialization().then((result) => {
      if (!active) return;
      if (result.gatewayStatus) {
        setStatus(result.gatewayStatus);
        onStatusChange(result.gatewayStatus);
      }
      if (result.error) setError(result.error.message);
      if (result.ready) {
        readyTimer = window.setTimeout(() => {
          if (!active) return;
          completionTimer = window.setTimeout(() => {
            if (active) setInitializationReady(true);
          }, STARTUP_READY_HOLD_MS);
        }, getStartupReadyDelay(Date.now() - bootStartedAt));
      } else {
        setInitializationReady(false);
        setCompanionWakeComplete(false);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(readyTimer);
      window.clearTimeout(completionTimer);
    };
  }, [onStatusChange]);

  useEffect(() => {
    if (!initializationReady) return undefined;

    let active = true;

    async function runCompanionWakeSequence() {
      setCompanionWakeComplete(false);
      const timeline = getStartupCompanionWakeTimeline({
        reducedMotion: prefersReducedMotion(),
      });

      for (const step of timeline) {
        if (!active) return;
        await wait(step.durationMs);
      }

      if (!active) return;
      setCompanionWakeComplete(true);
      startupEvents.emit(STARTUP_EVENTS.ON_BOOT_COMPLETE);
    }

    runCompanionWakeSequence();

    return () => {
      active = false;
    };
  }, [initializationReady]);

  const activate = async () => {
    if (activationPending || !companionWakeComplete) return;
    setActivationPending(true);
    setError('');
    try {
      const result = await selectStartupMode(STARTUP_ACTIVATION_MODE);
      const nextStatus = {
        ...result,
        ownerUnlocked: status?.ownerUnlocked === true,
        ownerAccessAvailable: status?.ownerAccessAvailable,
      };
      setStatus(nextStatus);
      onStatusChange(nextStatus);
      startupEvents.emit(STARTUP_EVENTS.ON_MODE_SELECTED, { mode: result.mode });
      setExiting(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActivationPending(false);
    }
  };

  const completeExit = (event) => {
    if (!exiting || event.target !== event.currentTarget) return;
    startupEvents.emit(STARTUP_EVENTS.ON_SYSTEM_READY, { mode: status?.mode });
    setExiting(false);
    onClose();
  };

  if (!open && status?.selected) return null;

  return (
    <section
      className={`startup-gateway ${initializationReady ? 'boot-complete' : 'booting'} ${exiting ? 'is-exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="startup-gateway-title"
      onTransitionEnd={completeExit}
    >
      <div className="startup-gateway-shell">
        <header>
          <h1 id="startup-gateway-title">
            {titleLetters.map((letter, index) => (
              letter === ' ' ? (
                <span key={`space-${index}`} className="startup-title-space" aria-hidden="true"> </span>
              ) : (
                <span
                  key={`${letter}-${index}`}
                  className="startup-title-letter"
                >
                  {letter}
                </span>
              )
            ))}
          </h1>
          <p className="startup-system-label">LOCAL COMMAND SYSTEM</p>
        </header>

        <button
          type="button"
          className="startup-activate"
          disabled={!companionWakeComplete || activationPending}
          onClick={activate}
        >
          {activationPending || !companionWakeComplete ? 'Initializing' : 'Activate'}
        </button>

        {error && <p className="startup-gateway-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
