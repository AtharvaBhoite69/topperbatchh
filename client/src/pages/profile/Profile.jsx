import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import ComicInput from '../../components/ui/ComicInput';
import { ComicBadge, LoadingSkeleton } from '../../components/ui/ComicElements';
import { profile as profileApi } from '../../services/api';
import {
  User,
  Trophy,
  Flame,
  Award,
  Edit,
  GraduationCap,
  Calendar,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Profile = () => {
  const { user, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [semester, setSemester] = useState(3);
  const [department, setDepartment] = useState('');
  const [bio, setBio] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await profileApi.getProfile();
        if (res.data?.success && res.data.profile) {
          setProfileData(res.data.profile);
          setFullName(res.data.profile.full_name || '');
          setSemester(res.data.profile.semester || 3);
          setDepartment(res.data.profile.department || '');
          setBio(res.data.profile.bio || '');
        }
      } catch (err) {
        toast.error('Failed to load profile details.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await profileApi.updateProfile({
        full_name: fullName,
        semester: parseInt(semester, 10),
        department,
        bio,
        change_reason: changeReason,
      });

      if (res.data?.success) {
        setProfileData((prev) => ({
          ...prev,
          ...res.data.profile,
          pendingChangeRequest: res.data.pendingChangeRequest !== undefined ? res.data.pendingChangeRequest : prev?.pendingChangeRequest,
        }));
        updateUser(res.data.profile);
        setIsEditing(false);
        setChangeReason('');
        toast.success(res.data.message || 'Profile updated successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  const p = profileData || user;

  const defaultAchievements = [
    { name: 'First Blood', desc: 'Completed your first daily challenge', earned: true, icon: '⚡' },
    { name: '3-Day Streak', desc: 'Maintained 3 consecutive days of study', earned: (p.study_streak || 0) >= 3, icon: '🔥' },
    { name: '7-Day Streak', desc: 'Maintained a full week streak', earned: (p.study_streak || 0) >= 7, icon: '🌟' },
    { name: 'Centurion', desc: 'Crossed 100 total competition points', earned: (p.total_points || 0) >= 100, icon: '🛡️' },
    { name: 'Top 3 Finisher', desc: 'Reached the podium in a daily battle', earned: (p.rank || 99) <= 3, icon: '👑' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none">
      {/* Pending Department / Semester Change Request Alert */}
      {p.pendingChangeRequest && (
        <div className="comic-box bg-comic-yellow p-4 border-[3px] border-ink shadow-[4px_4px_0px_#171510] flex items-start gap-3">
          <Clock className="w-5 h-5 text-punch-red flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="font-heading text-sm uppercase text-ink flex items-center gap-2">
              <span>ACADEMIC CHANGE REQUEST PENDING ADMIN APPROVAL</span>
              <span className="font-comic text-[9px] bg-punch-red text-cream px-1.5 py-0.2 rounded border border-ink">
                UNDER REVIEW
              </span>
            </h4>
            <p className="font-sans text-xs text-ink/80 font-medium">
              You requested a transfer to <strong>{p.pendingChangeRequest.requested_department} • Semester {p.pendingChangeRequest.requested_semester}</strong>.
              Your materials and daily battle access will switch as soon as an administrator verifies and approves your request.
            </p>
            {p.pendingChangeRequest.reason && (
              <p className="font-mono text-[11px] text-ink/70 italic">
                Reason given: "{p.pendingChangeRequest.reason}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* Profile Header Box */}
      <div className="comic-box-lg bg-cream p-6 sm:p-8 relative flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          {/* Avatar with comic outline */}
          <div className="w-20 h-20 rounded-full bg-comic-yellow text-ink font-heading font-black text-3xl flex items-center justify-center border-[4px] border-ink shadow-[4px_4px_0px_#171510] flex-shrink-0">
            {p.full_name ? p.full_name.slice(0, 2).toUpperCase() : 'TB'}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="font-heading text-3xl sm:text-4xl uppercase tracking-tight text-ink">
                {p.full_name}
              </h1>
              {p.role === 'admin' ? (
                <ComicBadge variant="red">PERMANENT ADMIN</ComicBadge>
              ) : (
                <ComicBadge variant="green">VERIFIED STUDENT</ComicBadge>
              )}
            </div>

            <div className="font-mono text-xs text-olive-dark font-bold flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span>{p.department || 'Computer Science'}</span>
              <span>•</span>
              <span>Semester {p.semester || 3}</span>
              <span>•</span>
              <span>{p.email}</span>
            </div>

            {p.bio ? (
              <p className="font-sans text-xs text-ink/80 italic max-w-md pt-1">
                "{p.bio}"
              </p>
            ) : (
              <p className="font-sans text-xs text-olive-dark/70 pt-1">
                No bio added yet. Click edit to set your semester goals!
              </p>
            )}
          </div>
        </div>

        <ComicButton
          variant="yellow"
          size="sm"
          onClick={() => setIsEditing(true)}
          icon={<Edit className="w-4 h-4" />}
        >
          EDIT PROFILE
        </ComicButton>
      </div>

      {/* Gamification Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="comic-box bg-white p-4 text-center">
          <div className="text-punch-red font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <Trophy className="w-4 h-4" /> TOTAL POINTS
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {p.total_points || 0}
          </div>
        </div>

        <div className="comic-box bg-white p-4 text-center">
          <div className="text-victory-green font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <Award className="w-4 h-4" /> BATCH RANK
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            #{p.rank || 1}
          </div>
        </div>

        <div className="comic-box bg-white p-4 text-center">
          <div className="text-punch-red font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 fill-current" /> STUDY STREAK
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {p.study_streak || 0}d
          </div>
        </div>

        <div className="comic-box bg-white p-4 text-center">
          <div className="text-ink font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4 text-comic-yellow" /> ACTIVE GOAL
          </div>
          <div className="font-heading text-2xl text-punch-red mt-1">
            9.0+ SGPA
          </div>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="comic-box bg-white p-6">
        <div className="flex items-center gap-2 mb-4 border-b-2 border-ink/20 pb-3">
          <Award className="w-6 h-6 text-punch-red" />
          <h2 className="font-heading text-2xl uppercase tracking-wide text-ink">
            BATCH BADGES & ACHIEVEMENTS
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {defaultAchievements.map((ach, idx) => (
            <div
              key={idx}
              className={`comic-box-sm p-3.5 flex items-start gap-3 transition-all ${
                ach.earned
                  ? 'bg-cream border-ink shadow-[2px_2px_0px_#171510]'
                  : 'bg-cream/40 border-ink/30 opacity-50'
              }`}
            >
              <div className="text-2xl flex-shrink-0">{ach.icon}</div>
              <div>
                <h4 className="font-heading text-sm uppercase text-ink">
                  {ach.name}
                </h4>
                <p className="font-sans text-[11px] text-olive-dark font-medium leading-tight mt-0.5">
                  {ach.desc}
                </p>
                {ach.earned && (
                  <span className="font-comic text-[9px] text-victory-green font-bold uppercase block mt-1">
                    UNLOCKED ✓
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="comic-box-lg max-w-md w-full bg-cream p-6 animate-in fade-in">
            <h3 className="font-heading text-2xl uppercase tracking-wide text-ink mb-4">
              EDIT STUDENT PROFILE
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <ComicInput
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
                    {[
                      'Computer Science',
                      'Information Tech',
                      'Data Science',
                      'AI & ML',
                      'Electronics',
                    ].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notice if Department or Semester was modified */}
              {p.role !== 'admin' && (department !== p.department || parseInt(semester, 10) !== parseInt(p.semester, 10)) && (
                <div className="comic-box-sm bg-comic-yellow/30 border-2 border-ink p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-punch-red font-comic text-xs uppercase font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>REQUIRES ADMIN APPROVAL</span>
                  </div>
                  <p className="font-sans text-[11px] text-ink/80 leading-snug">
                    Department and Semester changes are verified by administrators to prevent unauthorized access. Once approved, your content vault will switch.
                  </p>
                  <div>
                    <label className="font-comic text-[10px] uppercase text-ink block mb-1">
                      REASON FOR TRANSFER (REQUIRED):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Transferred branch / Promoted to next sem"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      className="comic-input text-xs py-1.5 bg-white"
                    />
                  </div>
                </div>
              )}

              <ComicInput
                label="Personal Bio / Exam Target"
                textarea={true}
                rows={3}
                placeholder="Targeting 9.5 SGPA this sem..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="comic-btn comic-btn-white text-sm"
                >
                  CANCEL
                </button>
                <ComicButton type="submit" variant="yellow" size="sm" loading={saving}>
                  SAVE CHANGES
                </ComicButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

