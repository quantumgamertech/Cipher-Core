import { listIntegrations } from '../../services/integrations/integrationService.js';

export default function IntegrationsPanel() {
  const integrations = listIntegrations();

  return (
    <section className="panel integrations-panel">
      <div className="panel-heading">
        <span>INTEGRATION MATRIX</span>
        <small>ALL CONNECTIONS DISABLED</small>
      </div>
      <div className="integration-grid">
        {integrations.map((integration) => (
          <article className="integration-card" key={integration.id}>
            <div>
              <span className="integration-state" />
              <small>{integration.category}</small>
            </div>
            <strong>{integration.name}</strong>
            <p>{integration.metric}</p>
            <footer>
              <b>{integration.status}</b>
              <span>{integration.dataMode} · {integration.lastChecked}</span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
