import { operatorModes } from '../../data/operatorModes.js';

export default function OperatorPanel({ activeMode, onChange }) {
  const selected = operatorModes.find((mode) => mode.id === activeMode) ?? operatorModes[0];

  return (
    <section className="panel operator-panel">
      <div className="panel-heading">
        <span>OPERATOR MODES</span>
        <small>SIMULATED ONLY</small>
      </div>
      <div className="operator-mode-grid">
        {operatorModes.map((mode) => (
          <button
            type="button"
            key={mode.id}
            aria-pressed={mode.id === activeMode}
            className={mode.id === activeMode ? 'active' : ''}
            onClick={() => onChange(mode.id)}
          >
            <i style={{ background: mode.accent }} />
            {mode.label.replace(' Mode', '')}
          </button>
        ))}
      </div>
      <div className="mode-brief">
        <span>{selected.label.toUpperCase()} // {selected.focus}</span>
        {selected.actions.map((action) => <small key={action}>◇ {action} <b>MOCK</b></small>)}
      </div>
    </section>
  );
}
