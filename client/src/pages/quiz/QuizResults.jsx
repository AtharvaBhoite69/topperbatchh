import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { ComicBadge, LoadingSkeleton } from '../../components/ui/ComicElements';
import { quiz as quizApi } from '../../services/api';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  ArrowRight,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const QuizResults = () => {
  const { id } = useParams(); // challengeId
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await quizApi.getResults(id);
        if (res.data?.success) {
          setData(res.data);
        }
      } catch (err) {
        toast.error('Could not load quiz results.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  if (!data?.attempt) {
    return (
      <div className="max-w-md mx-auto my-12 comic-box p-6 bg-white text-center">
        <h3 className="font-heading text-xl uppercase mb-2">NO RESULTS FOUND</h3>
        <p className="font-sans text-xs text-olive-dark mb-4">
          You haven't completed this quiz yet.
        </p>
        <Link to="/daily-challenge">
          <ComicButton variant="yellow" size="sm">
            GO TO ARENA
          </ComicButton>
        </Link>
      </div>
    );
  }

  const { attempt, review = [] } = data;
  const totalQ = review.length;
  const accuracy = totalQ > 0 ? Math.round((attempt.total_correct / totalQ) * 100) : 0;
  const minutes = Math.floor((attempt.time_taken_seconds || 0) / 60);
  const seconds = (attempt.time_taken_seconds || 0) % 60;

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none">
      {/* Big Score Card */}
      <div className="comic-box-lg bg-cream p-6 sm:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <ComicBadge variant="green" className="mb-1">
            BATTLE REPORT CONCLUDED
          </ComicBadge>
          <h1 className="font-heading text-4xl sm:text-5xl uppercase tracking-tight text-ink">
            {attempt.challenge_title || 'DAILY MCQ CHALLENGE'}
          </h1>
          <p className="font-sans text-xs sm:text-sm text-vintage-olive font-medium">
            Your points have been recorded to the batch leaderboard and your study streak has been boosted!
          </p>
        </div>

        {/* Big Starburst Score Widget */}
        <div className="comic-box bg-comic-yellow p-4 text-center min-w-[160px] border-[3px] border-ink shadow-[6px_6px_0px_#171510] flex-shrink-0">
          <span className="font-comic text-xs uppercase text-ink font-bold block">
            TOTAL SCORE
          </span>
          <div className="font-heading text-5xl text-ink leading-tight">
            {attempt.score}
          </div>
          <span className="font-mono text-[11px] text-punch-red font-bold block mt-1">
            +{attempt.score} BATCH PTS EARNED
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="comic-box bg-white p-4 text-center">
          <div className="text-victory-green font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> CORRECT
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {attempt.total_correct}
          </div>
        </div>

        <div className="comic-box bg-white p-4 text-center">
          <div className="text-punch-red font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <XCircle className="w-4 h-4" /> INCORRECT
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {attempt.total_incorrect}
          </div>
        </div>

        <div className="comic-box bg-white p-4 text-center">
          <div className="text-ink font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <Award className="w-4 h-4 text-comic-yellow" /> ACCURACY
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {accuracy}%
          </div>
        </div>

        <div className="comic-box bg-white p-4 text-center">
          <div className="text-ink font-comic text-xs uppercase font-bold flex items-center justify-center gap-1">
            <Clock className="w-4 h-4 text-punch-red" /> TIME TAKEN
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Quick Action Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/leaderboard">
          <ComicButton variant="yellow" size="md" icon={<Trophy className="w-4 h-4" />}>
            VIEW BATCH LEADERBOARD
          </ComicButton>
        </Link>
        <Link to="/dashboard">
          <ComicButton variant="white" size="md">
            BACK TO DASHBOARD
          </ComicButton>
        </Link>
      </div>

      {/* Detailed Solution & Explanations Review */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-ink/20 pb-2">
          <BookOpen className="w-5 h-5 text-punch-red" />
          <h2 className="font-heading text-2xl uppercase tracking-wide text-ink">
            DETAILED ANSWERS & EXPLANATIONS
          </h2>
        </div>

        {review.map((item, index) => {
          return (
            <div
              key={index}
              className={`comic-box p-6 bg-white space-y-4 border-l-[8px] ${
                item.isCorrect ? 'border-l-victory-green' : 'border-l-punch-red'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-comic text-xs uppercase bg-cream text-ink px-2 py-0.5 rounded border border-ink">
                  QUESTION #{index + 1}
                </span>
                {item.isCorrect ? (
                  <span className="font-comic text-xs bg-victory-green text-cream px-2 py-0.5 rounded border border-ink flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> CORRECT (+10 PTS)
                  </span>
                ) : (
                  <span className="font-comic text-xs bg-punch-red text-cream px-2 py-0.5 rounded border border-ink flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> INCORRECT (0 PTS)
                  </span>
                )}
              </div>

              <h4 className="font-sans font-bold text-base text-ink">
                {item.questionText}
              </h4>

              {/* Options */}
              <div className="space-y-2">
                {item.options?.map((opt, oIdx) => {
                  const isSelected = item.selectedOptionId === opt.id;
                  const isRightAnswer = opt.is_correct === 1;

                  let optClass = 'bg-cream/40 border-ink/30 text-ink';
                  if (isRightAnswer) {
                    optClass = 'bg-victory-green/15 border-victory-green text-ink font-bold';
                  } else if (isSelected && !item.isCorrect) {
                    optClass = 'bg-punch-red/15 border-punch-red text-ink line-through';
                  }

                  return (
                    <div
                      key={opt.id}
                      className={`comic-box-sm p-3 flex items-center justify-between text-xs font-sans ${optClass}`}
                    >
                      <span>{opt.option_text}</span>
                      {isRightAnswer && (
                        <span className="font-comic text-[10px] bg-victory-green text-cream px-1.5 py-0.5 rounded border border-ink uppercase">
                          CORRECT ANSWER ✓
                        </span>
                      )}
                      {isSelected && !isRightAnswer && (
                        <span className="font-comic text-[10px] bg-punch-red text-cream px-1.5 py-0.5 rounded border border-ink uppercase">
                          YOUR CHOICE ✗
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation Note */}
              {item.explanation && (
                <div className="comic-dashed-box bg-cream text-xs font-sans text-olive-dark p-3 space-y-1">
                  <div className="font-comic text-xs uppercase text-punch-red font-bold flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" /> EXPLANATION & EXAM CONCEPT:
                  </div>
                  <p className="leading-relaxed font-medium">{item.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuizResults;

