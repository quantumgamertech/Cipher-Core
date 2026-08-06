import { tasks } from '../data/mockStats.js';
import { getHardwareBusSnapshot } from '../services/hardware/hardwareBus.js';

export function TodayPanel() {
  return (
    <section className="panel today-panel">
      <div className="panel-heading">
        <span>TODAY</span>
        <small>ACTIVE SEQUENCE</small>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <div className={`task-row ${task.done ? 'complete' : ''}`} key={task.title}>
            <span className="task-check">{task.done ? '✓' : ''}</span>
            <div><strong>{task.title}</strong><small>{task.meta}</small></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HardwarePanel() {
  const bus = getHardwareBusSnapshot();
  return (
    <section className="panel hardware-panel">
      <div className="panel-heading">
        <span>HARDWARE BUS</span>
        <small>CONTROL {bus.controlEnabled ? 'ENABLED' : 'DISABLED'}</small>
      </div>
      <div className="hardware-grid">
        {bus.devices.map((device) => (
          <div className="hardware-item" key={device.name}>
            <span className={device.state} />
            <div><strong>{device.name}</strong><small>{device.status} · {device.detail}</small></div>
          </div>
        ))}
      </div>
    </section>
  );
}
