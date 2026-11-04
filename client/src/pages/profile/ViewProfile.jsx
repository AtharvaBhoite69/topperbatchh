import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { ComicBadge, LoadingSkeleton } from '../../components/ui/ComicElements';
import { profile as profileApi } from '../../services/api';
import { User, Trophy, Flame, Award, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export const ViewProfile = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await profileApi.getOtherProfile(id);
        if (res.data?.success) {
          setProfile(res.data.profile);
        }
      } catch (err) {
        toast.error('Could not load student profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <LoadingSkeleton count={2} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="comic-box p-6 bg-white text-center max-w-md mx-auto my-12">
        <h3 className="font-heading text-xl uppercase mb-2">STUDENT NOT FOUND</h3>
        <Link to="/leaderboard">
          <ComicButton variant="yellow" size="sm">
            BACK TO LEADERBOARD
          </ComicButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none">
      <Link to="/leaderboard">
        <ComicButton variant="white" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
          BACK TO RANKINGS
        </ComicButton>
      </Link>

      <div className="comic-box-lg bg-cream p-6 sm:p-8 flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-comic-yellow text-ink font-heading font-black text-3xl flex items-center justify-center border-[4px] border-ink shadow-[4px_4px_0px_#171510] flex-shrink-0">
          {profile.full_name ? profile.full_name.slice(0, 2).toUpperCase() : 'ST'}
        </div>

        <div className="space-y-1">
          <h1 className="font-heading text-3xl uppercase tracking-tight text-ink">
            {profile.full_name}
          </h1>
          <div className="font-mono text-xs text-olive-dark font-bold">
            {profile.department || 'Student'} • Semester {profile.semester || 1}
          </div>
          {profile.bio && (
            <p className="font-sans text-xs text-ink/80 italic pt-1">
              "{profile.bio}"
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="comic-box bg-white p-4 text-center">
          <div className="text-punch-red font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <Trophy className="w-4 h-4" /> TOTAL POINTS
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {profile.total_points || 0}
          </div>
        </div>

        <div className="comic-box bg-white p-4 text-center">
          <div className="text-victory-green font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <Award className="w-4 h-4" /> BATCH RANK
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            #{profile.rank || 1}
          </div>
        </div>

        <div className="comic-box bg-white p-4 text-center">
          <div className="text-punch-red font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 fill-current" /> STUDY STREAK
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {profile.study_streak || 0}d
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProfile;

