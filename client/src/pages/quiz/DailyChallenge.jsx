import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { ComicBadge, EmptyState, LoadingSkeleton } from '../../components/ui/ComicElements';
import { quiz as quizApi } from '../../services/api';
import { Zap, Clock, Trophy, Award, CheckCircle2, ArrowRight, Play, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export const DailyChallenge = () => {
  const navigate = useNavigate();
  const [dailyData, setDailyData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const fetchDaily = async () => {
      try {
        const [dailyRes, histRes] = await Promise.all([
          quizApi.getDaily(),
          quizApi.getDailyHistory(),
        ]);

        if (dailyRes.data?.success) {
          setDailyData(dailyRes.data);
        }
        if (histRes.data?.success) {
          setHistory(histRes.data.history || []);
        }
      } catch (err) {
        toast.error('Failed to load challenge details.');
      } finally {
        setLoading(false);
      }
    };

    fetchDaily();
  }, []);

  const handleStartChallenge = async () => {
    if (!dailyData?.challenge) return;
    setStarting(true);
    try {
      const res = await quizApi.startAttempt(dailyData.challenge.id);
      if (res.data?.success) {
        navigate(`/quiz/${dailyData.challenge.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start challenge attempt.');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  const challenge = dailyData?.challenge;
  const userAttempt = dailyData?.userAttempt;

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-left">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-7 h-7 text-punch-red fill-punch-red" />
            <h1 className="font-heading text-3xl sm:text-4xl uppercase tracking-wide text-ink">
              DAILY MCQ COMPETITION ARENA
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            10 randomized syllabus questions every day. One official attempt per student.
            Climb the batch leaderboard, build your daily study streak, and sharpen exam readiness.
          </p>
        </div>

        <Link to="/leaderboard">
          <ComicButton variant="yellow" size="sm" icon={<Trophy className="w-4 h-4" />}>
            VIEW RANKINGS
          </ComicButton>
        </Link>
      </div>

      {/* Today's Active Challenge Card */}
      {challenge ? (
        <div className="comic-box-lg bg-cream p-6 sm:p-8 relative overflow-hidden">
          {/* Reference Screenshot Style Presale Ribbon */}
          <div className="absolute -top-3 right-6 bg-punch-red text-cream font-comic text-xs uppercase px-3 py-1 rounded border-2 border-ink shadow-[2px_2px_0px_#171510] rotate-2">
            DAILY ARENA LIVE!
          </div>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="flex items-center gap-2">
                <ComicBadge variant="yellow">
                  {challenge.subject_name || 'All-Subject Mixed'}
                </ComicBadge>
                <span className="font-mono text-xs bg-white px-2 py-0.5 border border-ink rounded">
                  {challenge.total_questions || 10} QUESTIONS
                </span>
                <span className="font-mono text-xs bg-white px-2 py-0.5 border border-ink rounded flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {challenge.duration_minutes || 15} MINS
                </span>
              </div>

              <h2 className="font-heading text-3xl sm:text-4xl uppercase tracking-tight text-ink">
                {challenge.title}
              </h2>

              <p className="font-sans text-xs sm:text-sm text-vintage-olive font-medium leading-relaxed">
                {challenge.description ||
                  'Official daily battle generated from previous year papers. Timer begins immediately once you enter the arena.'}
              </p>

              {/* Scoring Rules Breakdown */}
              <div className="comic-dashed-box grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-olive-dark block text-[10px]">CORRECT ANSWER</span>
                  <strong className="text-victory-green font-heading text-base">+{challenge.scoring_correct} PTS</strong>
                </div>
                <div>
                  <span className="text-olive-dark block text-[10px]">WRONG / BLANK</span>
                  <strong className="text-ink font-heading text-base">0 PTS</strong>
                </div>
                <div>
                  <span className="text-olive-dark block text-[10px]">PARTICIPATION BONUS</span>
                  <strong className="text-punch-red font-heading text-base">+{challenge.participation_bonus} PTS</strong>
                </div>
              </div>
            </div>

            {/* Action Box */}
            <div className="w-full lg:w-72 comic-box bg-white p-5 text-center flex flex-col justify-between flex-shrink-0">
              {userAttempt?.is_submitted ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-victory-green text-cream rounded-full border-2 border-ink shadow-[2px_2px_0px_#171510] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-comic text-xs uppercase text-victory-green font-bold">
                      ATTEMPT SUBMITTED ✓
                    </span>
                    <div className="font-heading text-4xl text-ink mt-0.5">
                      {userAttempt.score} PTS
                    </div>
                  </div>
                  <Link to={`/quiz/${challenge.id}/results`} className="block">
                    <ComicButton variant="olive" size="sm" className="w-full">
                      REVIEW ANSWERS
                    </ComicButton>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="font-comic text-sm uppercase text-ink/80">
                    ONE OFFICIAL SHOT TODAY
                  </div>
                  <ComicButton
                    variant="red"
                    size="lg"
                    className="w-full"
                    loading={starting}
                    onClick={handleStartChallenge}
                    icon={<Play className="w-5 h-5 fill-current" />}
                  >
                    START BATTLE!
                  </ComicButton>
                  <div className="text-[10px] font-mono text-ink/70">
                    Scores are verified server-side. Auto-submits when time expires.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon="⏳"
          title="NO ACTIVE BATTLE TODAY"
          description="The administrators have not activated today's challenge yet. Check back in a little while!"
        />
      )}

      {/* Past Daily Challenges */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-punch-red" />
          <h3 className="font-heading text-2xl uppercase tracking-wide text-ink">
            PAST BATTLES HISTORY
          </h3>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-olive-dark font-sans py-2">
            No past competitions recorded yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((h) => (
              <ComicCard key={h.id} accent="olive" className="bg-white p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-[10px] text-ink/70">
                    {h.challenge_date}
                  </span>
                  {h.score !== null ? (
                    <span className="font-comic text-[11px] bg-victory-green text-cream px-1.5 py-0.5 rounded border border-ink">
                      {h.score} PTS
                    </span>
                  ) : (
                    <span className="font-comic text-[11px] bg-secondary-grey text-ink px-1.5 py-0.5 rounded border border-ink">
                      MISSED
                    </span>
                  )}
                </div>
                <h4 className="font-heading text-lg uppercase text-ink line-clamp-1">
                  {h.title}
                </h4>
                <div className="text-xs font-mono text-olive-dark mt-1">
                  Subject: {h.subject_name || 'General'}
                </div>

                {h.score !== null && (
                  <Link to={`/quiz/${h.id}/results`} className="mt-3 block">
                    <span className="font-comic text-xs uppercase text-punch-red hover:underline flex items-center gap-1">
                      REVIEW SOLUTIONS <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                )}
              </ComicCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyChallenge;

