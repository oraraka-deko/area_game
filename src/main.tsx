import './polyfill.js';
import React, { StrictMode, Component, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App.tsx';
import './index.css';

// Robust manifest URL resolution
function getManifestUrl(): string {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
      return `${window.location.origin}/tonconnect-manifest.json`;
    }
  } catch (e) {
    console.warn('Error reading window.location.origin:', e);
  }
  return '/tonconnect-manifest.json';
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Uncaught Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0c14] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-16 h-16 rounded-3xl bg-red-500/20 text-red-400 flex items-center justify-center text-3xl mb-4 border border-red-500/30">
            ⚠️
          </div>
          <h1 className="text-xl font-black uppercase tracking-wider text-white">
            Arena Load Notice
          </h1>
          <p className="text-xs text-white/60 max-w-sm mt-2 leading-relaxed">
            The application encountered a temporary display issue.
          </p>
          {this.state.error && (
            <div className="mt-4 p-3 bg-black/50 border border-white/10 rounded-2xl max-w-md w-full text-left font-mono text-[11px] text-red-300 overflow-x-auto max-h-36">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="mt-6 px-6 py-3 rounded-2xl bg-[#ccff00] text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-[#ccff00]/20 active:scale-95 transition"
          >
            Reload Arena
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Safe wrapper for TonConnect in case iframe blocks localStorage or Web3
const SafeTonConnectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const manifestUrl = getManifestUrl();

  try {
    return (
      <TonConnectUIProvider manifestUrl={manifestUrl}>
        {children}
      </TonConnectUIProvider>
    );
  } catch (err) {
    console.warn('TonConnectUIProvider initialization error, falling back without provider:', err);
    return <>{children}</>;
  }
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <SafeTonConnectProvider>
          <App />
        </SafeTonConnectProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
