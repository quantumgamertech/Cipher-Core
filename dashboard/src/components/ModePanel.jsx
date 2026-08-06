const modes = ['idle', 'listening', 'thinking', 'speaking', 'alert'];

export default function ModePanel({ activeMode, onChange }) {
  return (
    <section className="panel mode-panel">
      <div className="panel-heading">
        <span>CORE MODE</span>
        <small>MANUAL CONTROL</small>
      </div>
      <div className="mode-controls">
        {modes.map((mode) => (
          <button
            type="button"
            key={mode}
            className={activeMode === mode ? 'active' : ''}
            aria-pressed={activeMode === mode}
            onClick={() => onChange(mode)}
          >
            <span />
            {mode}
          </button>
        ))}
      </div>
    </section>
  );
}
