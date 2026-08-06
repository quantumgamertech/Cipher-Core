import { versions } from '../../data/versions.js';

export default function VersionTimeline() {
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <span>VERSION TIMELINE</span>
        <small>PRE-1.0 FOUNDATION</small>
      </div>
      <div className="version-track">
        {versions.map((item) => (
          <div key={item.version}>
            <i />
            <strong>{item.version}</strong>
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
