import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, details) {
    console.error('Cipher dashboard entered safe fallback mode.', error, details);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="safe-fallback">
          <div>
            <span>CIPHER // SAFE FALLBACK</span>
            <h1>Dashboard signal interrupted</h1>
            <p>No commands or hardware actions were executed. Reload the local dashboard to retry.</p>
            <button type="button" onClick={() => window.location.reload()}>RELOAD LOCAL UI</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
