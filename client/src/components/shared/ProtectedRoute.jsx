import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Logo from './Logo';

export const ProtectedRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-4">
        <Logo size="lg" />
        <div className="mt-8 font-comic text-2xl text-ink animate-bounce flex items-center gap-2">
          <span>⚡ LOADING TOPPERBATCH...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Account status handling
  if (user.status === 'pending') {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-center">
        <Logo size="md" />
        <div className="comic-box max-w-md w-full mt-8 p-6 bg-white">
          <div className="w-16 h-16 bg-comic-yellow border-[3px] border-ink rounded-full flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_#171510] text-3xl">
            ⏳
          </div>
          <h2 className="font-heading text-2xl uppercase tracking-wider text-ink mb-2">
            HOLD UP, RECRUIT!
          </h2>
          <p className="font-sans text-olive-dark text-sm mb-6 font-medium">
            Your registration is currently <span className="font-bold text-punch-red uppercase">PENDING APPROVAL</span> from an administrator.
            Once approved, you'll get immediate access to all QB materials, AI study companion, and daily competitions!
          </p>
          <div className="comic-dashed-box text-xs text-left mb-6 font-mono text-ink">
            <div><strong>Batch ID:</strong> {user.id}</div>
            <div><strong>Registered Email:</strong> {user.email}</div>
          </div>
          <button
            onClick={() => window.location.href = '/login'}
            className="comic-btn comic-btn-yellow w-full"
          >
            REFRESH STATUS
          </button>
        </div>
      </div>
    );
  }

  if (user.status === 'suspended') {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-center">
        <Logo size="md" />
        <div className="comic-box max-w-md w-full mt-8 p-6 bg-white border-punch-red">
          <div className="w-16 h-16 bg-punch-red border-[3px] border-ink rounded-full flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_#171510] text-3xl text-white">
            ⛔
          </div>
          <h2 className="font-heading text-2xl uppercase tracking-wider text-punch-red mb-2">
            ACCOUNT BENCHED!
          </h2>
          <p className="font-sans text-olive-dark text-sm mb-6 font-medium">
            Your account has been suspended by an administrator. Please reach out to the batch coordinators to resolve this.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="comic-btn comic-btn-olive w-full"
          >
            RETURN TO LOGIN
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;

