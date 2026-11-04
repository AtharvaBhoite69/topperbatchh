import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import ComicInput from '../../components/ui/ComicInput';
import ComicButton from '../../components/ui/ComicButton';
import { auth as authApi } from '../../services/api';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword({ token, password, confirmPassword });
      if (res.data?.success) {
        toast.success('Password updated successfully! You can now log in.');
        navigate('/login');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid or expired reset token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="SET NEW SECRET"
      subtitle="Enter your new password to regain access to your batch account."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ComicInput
          label="New Password"
          type="password"
          placeholder="••••••••"
          icon={<Lock className="w-4 h-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <ComicInput
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          icon={<Lock className="w-4 h-4" />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <ComicButton
          type="submit"
          variant="green"
          size="lg"
          className="w-full"
          loading={loading}
        >
          UPDATE PASSWORD!
        </ComicButton>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;

