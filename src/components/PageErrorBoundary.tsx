import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; pageName?: string; }
interface State { hasError: boolean; error?: Error; }

class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Něco se pokazilo</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>
            Obnovit stránku
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
export default PageErrorBoundary;
