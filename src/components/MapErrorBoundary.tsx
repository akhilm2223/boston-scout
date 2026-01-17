import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

class MapErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[MapErrorBoundary] System Overload:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: '#000000',
                    color: '#00F0FF', // Electric Cyan
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    textAlign: 'center',
                    border: '4px solid #DA291C', // Red border for danger
                    boxSizing: 'border-box'
                }}>
                    <h1 style={{ fontSize: '3rem', textShadow: '0 0 10px #00F0FF' }}>SYSTEM OVERLOAD</h1>
                    <h2 style={{ fontSize: '1.5rem', color: '#DA291C' }}>DATA LINK INTERRUPTED</h2>
                    <p style={{ marginTop: '2rem' }}>GEO-SPATIAL RENDERER FAILURE DETECTED.</p>
                    <p>INITIATING FALLBACK PROTOCOLS...</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '3rem',
                            padding: '1rem 2rem',
                            background: 'transparent',
                            border: '2px solid #00F0FF',
                            color: '#00F0FF',
                            fontFamily: 'monospace',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            boxShadow: '0 0 15px #00F0FF'
                        }}
                    >
                        REBOOT SYSTEM
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default MapErrorBoundary;
