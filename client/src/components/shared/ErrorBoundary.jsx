import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TopperBatch Unhandled Application Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoLogin = () => {
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5E9D1] text-[#171510] flex flex-col items-center justify-center p-6 selection:bg-[#F5B900]">
          <div className="max-w-lg w-full bg-[#FFFDF8] border-[4px] border-[#171510] rounded-xl shadow-[8px_8px_0px_#171510] p-6 sm:p-8 text-center">
            <div className="inline-block bg-[#E54839] text-[#FFFDF8] font-black text-sm uppercase px-3 py-1 rounded border-2 border-[#171510] shadow-[2px_2px_0px_#171510] -rotate-2 mb-3">
              ⚠️ SYSTEM GLITCH CAUGHT
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#171510] mb-2 drop-shadow-[2px_2px_0px_#F5B900]">
              SOMETHING WENT WRONG!
            </h1>
            
            <p className="text-sm font-semibold text-[#666052] mb-5">
              The application encountered an unexpected runtime state. Don't worry, your data is safe.
            </p>

            {this.state.error?.message && (
              <div className="bg-[#171510] text-[#00E5FF] font-mono text-xs p-3 rounded-lg border-2 border-[#171510] text-left mb-6 overflow-x-auto max-h-36">
                <code>{this.state.error.toString()}</code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="bg-[#F5B900] text-[#171510] font-black uppercase text-sm px-6 py-3 rounded-lg border-[3px] border-[#171510] shadow-[4px_4px_0px_#171510] hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer"
              >
                🔄 RELOAD PAGE
              </button>
              <button
                onClick={this.handleGoLogin}
                className="bg-[#FFFDF8] text-[#171510] font-black uppercase text-sm px-6 py-3 rounded-lg border-[3px] border-[#171510] shadow-[4px_4px_0px_#171510] hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer"
              >
                🔑 GO TO LOGIN
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
