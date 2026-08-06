import { useRef, useState } from 'react';
import { parseCommand } from '../../services/commands/commandParser.js';

const initialHistory = [
  { type: 'system', text: 'CIPHER SAFE CONSOLE // execution sandbox active' },
  { type: 'system', text: 'Type “help” to view simulated commands.' },
];

export default function CommandConsole({ onEffect }) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState(initialHistory);
  const sequence = useRef(1);

  const submit = (event) => {
    event.preventDefault();
    const result = parseCommand(command);
    if (!result.command) return;
    setCommand('');
    if (result.effect?.type === 'CLEAR_CONSOLE') {
      setHistory(initialHistory);
      return;
    }
    setHistory((current) => [
      ...current.slice(-7),
      { id: sequence.current++, type: 'user', text: `> ${result.command}` },
      { id: sequence.current++, type: 'cipher', text: result.output },
    ]);
    onEffect?.(result.effect);
  };

  return (
    <section className="panel console-panel">
      <div className="panel-heading">
        <span>COMMAND CONSOLE</span>
        <small>WHITELISTED · SIMULATION ONLY</small>
      </div>
      <div className="console-output" role="log" aria-live="polite">
        {history.map((entry, index) => (
          <p className={entry.type} key={entry.id ?? `${entry.type}-${index}`}>{entry.text}</p>
        ))}
      </div>
      <form onSubmit={submit}>
        <label htmlFor="command-input">C:\CIPHER\SIM&gt;</label>
        <input
          id="command-input"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="type help"
          autoComplete="off"
          spellCheck="false"
        />
        <button type="submit">EXECUTE MOCK</button>
      </form>
    </section>
  );
}
