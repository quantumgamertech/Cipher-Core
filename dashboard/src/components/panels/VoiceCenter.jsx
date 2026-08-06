import { useSenses } from '../../hooks/useSenses.js';

export default function VoiceCenter({
  speech,
  progress,
  onListen,
  onStop,
  voiceMode = 'standby',
  error = '',
}) {
  const {
    senses,
    enableSense,
    disableSense,
  } = useSenses();

  return (
    <section className="panel voice-panel">
      <div className="panel-heading">
        <span>VOICE CENTER</span>
        <small>
          {voiceMode === 'live'
            ? 'ELEVENLABS'
            : voiceMode === 'simulation'
              ? 'SIMULATION'
              : voiceMode === 'connecting'
                ? 'CONNECTING'
                : 'LOCAL READY'}
        </small>
      </div>
      <label className="sr-only" htmlFor="voice-script">Voice phrase</label>
      <select id="voice-script" value="microphone" disabled>
        <option value="microphone">Microphone conversation</option>
      </select>
      <div className={`voice-transcript ${speech ? 'active' : ''}`}>
        <span>
          {speech
            ? voiceMode === 'listening'
              ? 'CIPHER // LISTENING'
              : voiceMode === 'thinking' || voiceMode === 'connecting'
                ? 'CIPHER // THINKING'
                : voiceMode === 'simulation'
              ? 'CIPHER // SIMULATION'
              : 'CIPHER // SPEAKING'
            : 'CIPHER // VOICE STANDBY'}
        </span>
        <p>{error || speech?.text || 'Select a phrase for Cipher to speak.'}</p>
      </div>
      <div className="speech-progress" aria-label="Speech progress">
        <i style={{ '--progress': `${progress}%` }} />
      </div>
      <div className="voice-actions">
        <button type="button" onClick={onListen} disabled={Boolean(speech)}>
          <span /> SPEAK
        </button>
        <button type="button" onClick={onStop} disabled={!speech}>STOP</button>
      </div>
      <div className="voice-senses" aria-label="Senses">
        <strong>SENSES</strong>
        {[
          ['microphone', 'MIC'],
          ['camera', 'CAMERA'],
        ].map(([id, label]) => {
          const ready = senses[id] === 'ready';
          return (
            <div key={id}>
              <span>{label}</span>
              <small data-status={senses[id]}>{ready ? 'READY' : 'OFFLINE'}</small>
              <button
                type="button"
                onClick={() => (ready ? disableSense(id) : enableSense(id))}
              >
                {ready ? 'Disable' : 'Enable'}
              </button>
            </div>
          );
        })}
        <div>
          <span>SPEAKERS</span>
          <small data-status={senses.speakers}>
            {senses.speakers === 'ready' ? 'READY' : 'OFFLINE'}
          </small>
        </div>
      </div>
    </section>
  );
}
