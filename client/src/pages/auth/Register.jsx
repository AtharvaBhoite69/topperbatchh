import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth as authApi } from '../../services/api';
import AuthLayout from '../../components/layout/AuthLayout';
import ComicInput from '../../components/ui/ComicInput';
import ComicButton from '../../components/ui/ComicButton';
import { User, Mail, Lock, GraduationCap, CheckCircle2, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const Register = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [semester, setSemester] = useState('3');
  const [department, setDepartment] = useState('Computer Science');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  // Step state: 'form' | 'otp' | 'submitted'
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [isAutoApproved, setIsAutoApproved] = useState(false);

  // OTP resend timer state: 3 minutes (180 seconds)
  const [resendTimer, setResendTimer] = useState(180);
  const [canResend, setCanResend] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let timer = null;
    if (step === 'otp' && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, resendTimer]);

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error('All fields are required.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      toast.error('Please enter a valid Gmail address.');
      return;
    }

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
      const res = await authApi.sendRegistrationOtp({
        email: email.trim(),
        fullName: fullName.trim(),
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Verification code sent to your Gmail!');
        setStep('otp');
        setResendTimer(180);
        setCanResend(false);
        setOtp('');
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.error || 'Could not send verification code. Please check your Gmail.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || loading) return;
    setLoading(true);
    try {
      const res = await authApi.sendRegistrationOtp({
        email: email.trim(),
        fullName: fullName.trim(),
      });
      if (res.data?.success) {
        toast.success('New 6-digit code sent to your Gmail!');
        setResendTimer(180);
        setCanResend(false);
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Could not resend OTP.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRegister = async (e) => {
    e.preventDefault();

    if (!otp || otp.trim().length < 6) {
      toast.error('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      const res = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        semester: parseInt(semester, 10),
        department,
        password,
        confirmPassword,
        otp: otp.trim(),
      });

      if (res?.success) {
        setStep('submitted');
        if (res.isAdmin || res.status === 'approved') {
          setIsAutoApproved(true);
          toast.success('Admin account auto-approved! Ready to log in.');
        } else {
          toast.success('Gmail verified & registration request sent to admins!');
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Registration failed. Please check the OTP.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'submitted') {
    return (
      <AuthLayout
        title={isAutoApproved ? 'ACCESS GRANTED!' : 'REQUEST SUBMITTED!'}
        subtitle="Your batch registration is in progress."
      >
        <div className="comic-box p-6 bg-white text-center">
          <div className="w-16 h-16 bg-victory-green border-[3px] border-ink rounded-full flex items-center justify-center mx-auto mb-4 text-cream shadow-[3px_3px_0px_#171510]">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h3 className="font-heading text-2xl uppercase tracking-wide text-ink mb-2">
            {isAutoApproved ? 'WELCOME, ADMINISTRATOR!' : 'GMAIL VERIFIED & AWAITING APPROVAL!'}
          </h3>

          <p className="font-sans text-xs text-olive-dark mb-6 leading-relaxed font-medium">
            {isAutoApproved
              ? 'Your email address matches the permanent administrator list. Your account is active immediately.'
              : 'Thank you for registering! Your Gmail address has been successfully verified. An administrator will review and approve your account shortly.'}
          </p>

          <Link to="/login">
            <ComicButton variant="yellow" size="md" className="w-full">
              PROCEED TO LOGIN
            </ComicButton>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (step === 'otp') {
    return (
      <AuthLayout
        title="VERIFY YOUR GMAIL"
        subtitle="We sent a 6-digit verification code to prove this Gmail is yours."
      >
        <form onSubmit={handleConfirmRegister} className="space-y-4">
          <div className="comic-box bg-white p-4 text-center space-y-2">
            <div className="w-12 h-12 bg-comic-yellow border-2 border-ink rounded-full flex items-center justify-center mx-auto shadow-[2px_2px_0px_#171510]">
              <ShieldCheck className="w-6 h-6 text-ink" />
            </div>

            <div className="text-xs font-sans text-olive-dark">
              Enter the 6-digit OTP code sent to:
            </div>

            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xs font-bold bg-cream px-2.5 py-1 border border-ink rounded truncate max-w-[240px]">
                {email}
              </span>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="text-[11px] font-comic uppercase text-punch-red underline font-bold hover:text-ink cursor-pointer"
              >
                EDIT
              </button>
            </div>
          </div>

          <div>
            <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1 text-left">
              6-DIGIT VERIFICATION CODE
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="comic-input text-2xl font-mono font-bold tracking-[10px] text-center py-2.5 bg-white uppercase"
              required
            />
            <p className="font-sans text-[11px] text-olive-dark mt-1 text-left">
              Check your Gmail inbox and spam/promotions folder. Code expires in 10 minutes.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="font-comic text-xs text-ink/70 hover:text-ink flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to details
            </button>

            {canResend ? (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="font-comic uppercase text-punch-red font-bold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Resend Code
              </button>
            ) : (
              <span className="font-mono text-olive-dark">
                Resend code in {resendTimer > 60 ? `${Math.floor(resendTimer / 60)}m ${String(resendTimer % 60).padStart(2, '0')}s` : `${resendTimer}s`}
              </span>
            )}
          </div>

          <ComicButton
            type="submit"
            variant="green"
            size="lg"
            className="w-full mt-2"
            loading={loading}
          >
            CONFIRM & SUBMIT REQUEST
          </ComicButton>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="JOIN THE BATCH"
      subtitle="Register to access private question banks, AI study tools, and daily MCQ competitions."
    >
      <form onSubmit={handleSendOtp} className="space-y-3.5">
        <ComicInput
          label="Full Name"
          type="text"
          placeholder="e.g. MODIHH Ji"
          icon={<User className="w-4 h-4" />}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <ComicInput
          label="Gmail Address (OTP verification will be sent)"
          type="email"
          placeholder="yourname@gmail.com"
          icon={<Mail className="w-4 h-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3 text-left">
          <div>
            <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
              SEMESTER
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="comic-input text-xs py-2 bg-white"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
              DEPARTMENT
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="comic-input text-xs py-2 bg-white"
            >
              <option value="AI & ML">AI & ML</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Information Tech">Information Tech</option>
              <option value="Data Science">Data Science</option>
              <option value="Electronics">Electronics</option>
              <option value="Computer Engineering">Computer Engineering</option>
            </select>
          </div>
        </div>

        <ComicInput
          label="Password (min 8 chars, 1 uppercase, 1 number)"
          type="password"
          placeholder="••••••••"
          icon={<Lock className="w-4 h-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <ComicInput
          label="Confirm Password"
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
          className="w-full mt-3"
          loading={loading}
        >
          VERIFY GMAIL & JOIN BATCH!
        </ComicButton>
      </form>

      <div className="mt-5 pt-3 border-t-2 border-ink/20 text-center">
        <p className="font-sans text-xs text-olive-dark font-medium">
          Already a batchmate?{' '}
          <Link
            to="/login"
            className="font-comic uppercase text-sm text-punch-red font-bold hover:underline"
          >
            LOGIN HERE!
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register;

