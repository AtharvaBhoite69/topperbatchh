import React from 'react';
import Logo from '../shared/Logo';

export const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-4 sm:p-6 comic-halftone-light relative overflow-hidden">
      {/* Decorative Starbursts in background */}
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-comic-yellow/30 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-punch-red/20 rounded-full blur-2xl pointer-events-none" />

      {/* Brand Logo Header */}
      <div className="mb-6 text-center z-10">
        <Logo size="lg" showTagline={true} />
      </div>

      {/* Main Comic Auth Box */}
      <div className="comic-box-lg max-w-md w-full bg-cream p-6 sm:p-8 z-10 relative">
        {/* Stage / Badge Ribbon */}
        <div className="absolute -top-4 right-4 bg-punch-red text-cream font-comic text-xs uppercase px-3 py-1 rounded border-2 border-ink shadow-[2px_2px_0px_#171510] rotate-2">
          GATEWAY ACCESS
        </div>

        {title && (
          <h2 className="font-heading text-3xl uppercase tracking-wider text-ink mb-1">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="font-sans text-xs text-olive-dark mb-6 font-medium">
            {subtitle}
          </p>
        )}

        {children}
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-center text-xs font-mono text-ink/70 z-10">
        🔒 TOPPERBATCH SECURE COMMUNITY // 100% PRIVATE BATCH ACCESS
      </div>
    </div>
  );
};

export default AuthLayout;

