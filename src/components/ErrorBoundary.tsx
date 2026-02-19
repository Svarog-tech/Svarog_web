import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // TODO: Odeslat do error tracking služby (Sentry, apod.)
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary, #1a1a2e)' }}>
            Nastala neočekávaná chyba
          </h1>
          <p style={{ marginBottom: '2rem', color: 'var(--text-secondary, #666)', maxWidth: '500px' }}>
            Omlouváme se, něco se pokazilo. Zkuste obnovit stránku nebo se vrátit na hlavní stránku.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre style={{
              background: '#fee',
              color: '#c00',
              padding: '1rem',
              borderRadius: '8px',
              maxWidth: '600px',
              overflow: 'auto',
              fontSize: '0.85rem',
              marginBottom: '2rem',
              textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.75rem 2rem',
              background: 'var(--primary-color, #e94560)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Zpět na hlavní stránku
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
