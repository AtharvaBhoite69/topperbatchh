import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import ComicInput from '../../components/ui/ComicInput';
import ComicButton from '../../components/ui/ComicButton';
import { auth as authApi } from '../../services/api';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Email is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email });
      if (res.data?.success) {
        setSent(true);
        if (res.data?.devResetToken) {
          setDevToken(res.data.devResetToken);
        }
        toast.success('Password reset instructions generated.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to request reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="LOST YOUR KEY?"
      subtitle="Enter your registered email to receive a password reset link."
    >
      {sent ? (
        <div className="comic-box p-6 bg-white text-center">
          <div className="w-14 h-14 bg-comic-yellow border-[3px] border-ink rounded-full flex items-center justify-center mx-auto mb-3 text-ink shadow-[2px_2px_0px_#171510]">
            <KeyRound className="w-7 h-7" />
          </div>
          <h3 className="font-heading text-xl uppercase mb-2">CHECK YOUR EMAIL</h3>
          <p className="font-sans text-xs text-olive-dark mb-4 font-medium">
            If an account is registered under <strong>{email}</strong>, a reset link has been dispatched.
          </p>

          {devToken && (
            <div className="comic-dashed-box text-left mb-4 p-3 bg-cream text-xs font-mono">
              <span className="font-bold text-punch-red uppercase block mb-1">
                DEV MODE TEST LINK:
              </span>
              <Link
                to={`/reset-password/${devToken}`}
                className="underline text-ink break-all font-bold hover:text-punch-red"
              >
                Click here to reset password directly
              </Link>
            </div>
          )}

          <Link to="/login">
            <ComicButton variant="olive" size="sm" className="w-full">
              RETURN TO LOGIN
            </ComicButton>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <ComicInput
            label="Gmail Address"
            type="email"
            placeholder="yourname@gmail.com"
            icon={<Mail className="w-4 h-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <ComicButton
            type="submit"
            variant="yellow"
            size="lg"
            className="w-full"
            loading={loading}
          >
            SEND RESET LINK
          </ComicButton>

          <div className="text-center mt-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-comic text-xs uppercase text-ink hover:text-punch-red"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> BACK TO LOGIN
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;

