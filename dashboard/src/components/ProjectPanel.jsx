import { projects } from '../data/mockStats.js';

export default function ProjectPanel() {
  return (
    <section className="panel project-panel">
      <div className="panel-heading">
        <span>PROJECT MATRIX</span>
        <small>4 WORKSPACES</small>
      </div>
      <div className="project-list">
        {projects.map((project, index) => (
          <div className="project-row" key={project.name}>
            <span className={`project-index ${project.accent}`}>0{index + 1}</span>
            <div><strong>{project.name}</strong><small>{project.status}</small></div>
            <i />
          </div>
        ))}
      </div>
    </section>
  );
}
