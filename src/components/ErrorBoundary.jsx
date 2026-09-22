import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '280px',
          padding: '32px 24px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e5e0d3',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          maxWidth: '480px',
          margin: '40px auto',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <AlertCircle size={26} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1f1d19', margin: '0 0 8px 0' }}>
            Something went wrong
          </h3>
          <p style={{ fontSize: '13.5px', color: '#666', lineHeight: 1.5, margin: '0 0 20px 0', maxWidth: '380px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. Please refresh or try again.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: '#1f1d19',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <RefreshCw size={15} /> Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
