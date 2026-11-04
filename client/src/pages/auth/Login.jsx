import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/layout/AuthLayout';
import ComicInput from '../../components/ui/ComicInput';
import ComicButton from '../../components/ui/ComicButton';
import { Mail, Lock, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await login(email, password);
      if (res?.success) {
        toast.success(`Welcome back, ${res.user?.full_name}!`);
        navigate(from, { replace: true });
      }
    } catch (err) {
      const errRes = err.response?.data;
      if (errRes?.status) {
        setStatusMessage({
          status: errRes.status,
          message: errRes.error || 'Account access restricted.',
        });
      } else {
        toast.error(errRes?.error || 'Invalid credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="ENTER THE ARENA"
      subtitle="Login with your verified college credentials to enter the batch."
    >
      {/* Account Status Alert if pending, rejected, or suspended */}
      {statusMessage && (
        <div className="comic-box p-4 mb-5 bg-white border-punch-red flex items-start gap-3 text-left">
          <ShieldAlert className="w-6 h-6 text-punch-red flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-comic text-sm uppercase text-punch-red font-bold">
              {statusMessage.status === 'pending'
                ? 'APPROVAL PENDING'
                : statusMessage.status === 'suspended'
                ? 'ACCOUNT BENCHED'
                : 'ACCESS DENIED'}
            </div>
            <p className="font-sans text-xs text-ink/80 mt-1 font-medium">
              {statusMessage.message}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <ComicInput
          label="College Email Address"
          type="email"
          placeholder="student@college.edu"
          icon={<Mail className="w-4 h-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <ComicInput
          label="Password"
          type="password"
          placeholder="••••••••"
          icon={<Lock className="w-4 h-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="font-comic text-xs uppercase text-punch-red hover:underline tracking-wide"
          >
            FORGOT PASSWORD?
          </Link>
        </div>

        <ComicButton
          type="submit"
          variant="yellow"
          size="lg"
          className="w-full mt-2"
          loading={loading}
          icon={<ArrowRight className="w-5 h-5" />}
        >
          ENTER ARENA!
        </ComicButton>
      </form>

      <div className="mt-6 pt-4 border-t-2 border-ink/20 text-center">
        <p className="font-sans text-xs text-olive-dark font-medium">
          New to the batch?{' '}
          <Link
            to="/register"
            className="font-comic uppercase text-sm text-punch-red font-bold hover:underline"
          >
            REQUEST BATCH ACCESS!
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;

