import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/layout/AuthLayout';
import ComicInput from '../../components/ui/ComicInput';
import ComicButton from '../../components/ui/ComicButton';
import { User, Mail, Lock, GraduationCap, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const Register = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [semester, setSemester] = useState('3');
  const [department, setDepartment] = useState('Computer Science');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isAutoApproved, setIsAutoApproved] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fullName || !email || !password || !confirmPassword) {
      toast.error('All fields are required.');
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
      const res = await register({
        fullName,
        email,
        semester: parseInt(semester, 10),
        department,
        password,
        confirmPassword,
      });

      if (res?.success) {
        setSubmitted(true);
        if (res.isAdmin || res.status === 'approved') {
          setIsAutoApproved(true);
          toast.success('Admin account auto-approved! Ready to log in.');
        } else {
          toast.success('Registration request sent to administrators!');
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Registration failed. Please check your inputs.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
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
            {isAutoApproved ? 'WELCOME, ADMINISTRATOR!' : 'AWAITING APPROVAL!'}
          </h3>

          <p className="font-sans text-xs text-olive-dark mb-6 leading-relaxed font-medium">
            {isAutoApproved
              ? 'Your email address matches the permanent administrator list. Your account is active immediately.'
              : 'Thank you for registering! To maintain the security and privacy of TopperBatch materials, an administrator must approve your account before you can log in.'}
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

  return (
    <AuthLayout
      title="JOIN THE BATCH"
      subtitle="Register to access private question banks, AI study tools, and daily MCQ competitions."
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
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
          label="College Email Address"
          type="email"
          placeholder="student@college.edu"
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
              <option value="Computer Science">Computer Science</option>
              <option value="Information Tech">Information Tech</option>
              <option value="Data Science">Data Science</option>
              <option value="AI & ML">AI & ML</option>
              <option value="Electronics">Electronics</option>
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
          JOIN THE BATCH!
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

