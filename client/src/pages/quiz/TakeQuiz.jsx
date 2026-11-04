import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { ProgressBar, ConfirmDialog } from '../../components/ui/ComicElements';
import { quiz as quizApi } from '../../services/api';
import { Clock, AlertTriangle, CheckCircle, ArrowLeft, ArrowRight, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export const TakeQuiz = () => {
  const { id } = useParams(); // challengeId
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionId }
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [totalSeconds, setTotalSeconds] = useState(15 * 60);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    const fetchChallengeQuestions = async () => {
      try {
        const res = await quizApi.getDaily();
        if (res.data?.success) {
          if (res.data.userAttempt?.is_submitted) {
            toast.error('You have already submitted this challenge attempt!');
            navigate(`/quiz/${id}/results`);
            return;
          }

          setChallenge(res.data.challenge);
          setQuestions(res.data.questions || []);

          const durationSec = (res.data.challenge?.duration_minutes || 15) * 60;
          setTimeLeft(durationSec);
          setTotalSeconds(durationSec);
        }
      } catch (err) {
        toast.error('Failed to load challenge questions.');
        navigate('/daily-challenge');
      } finally {
        setLoading(false);
      }
    };

    fetchChallengeQuestions();
  }, [id, navigate]);

  // Countdown Timer
  useEffect(() => {
    if (loading || !challenge) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [loading, challenge]);

  const handleSelectOption = (questionId, optionId) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleAutoSubmit = () => {
    toast('Time is up! Submitting your answers automatically...', { icon: '⏰' });
    handleSubmitQuiz();
  };

  const handleSubmitQuiz = async () => {
    if (submitting) return;
    setSubmitting(true);
    setConfirmModal(false);

    const timeTaken = totalSeconds - timeLeft;

    try {
      const res = await quizApi.submitAttempt(id, {
        answers,
        time_taken_seconds: timeTaken,
      });

      if (res.data?.success) {
        toast.success('Battle finished! Calculating leaderboard score...');
        navigate(`/quiz/${id}/results`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit quiz.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="font-comic text-2xl text-ink animate-bounce">
          ⚡ LOADING QUESTIONS & COMMENCING BATTLE...
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 comic-box p-6 bg-white text-center">
        <h3 className="font-heading text-2xl uppercase mb-2">NO QUESTIONS FOUND</h3>
        <p className="font-sans text-xs text-olive-dark mb-4">
          This challenge has no active questions assigned.
        </p>
        <button
          onClick={() => navigate('/daily-challenge')}
          className="comic-btn comic-btn-yellow text-sm"
        >
          RETURN TO CHALLENGES
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 120; // under 2 minutes
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none">
      {/* Top Bar: Progress and Countdown Tile (matching screenshot countdown style) */}
      <div className="comic-box bg-white p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-comic text-xs uppercase text-punch-red font-bold block">
            {challenge?.title || 'DAILY ARENA'}
          </span>
          <h2 className="font-heading text-xl uppercase tracking-wide text-ink">
            QUESTION {currentIndex + 1} OF {questions.length}
          </h2>
        </div>

        {/* Countdown Tile matching presale countdown aesthetic from screenshot */}
        <div className="flex items-center gap-2">
          <div className="text-right mr-1">
            <span className="text-[10px] font-comic uppercase text-olive-dark block leading-tight">
              TIME LEFT
            </span>
            <span className="text-[10px] font-mono text-ink/70">AUTO-SUBMITS</span>
          </div>
          <div
            className={`comic-countdown-tile flex items-center justify-center font-heading text-2xl px-4 py-1.5 ${
              isUrgent ? 'bg-punch-red text-cream animate-pulse' : 'bg-ink text-comic-yellow'
            }`}
          >
            <Clock className="w-5 h-5 mr-1.5 inline" />
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Progress Dots Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-3 comic-box-sm bg-cream">
        {questions.map((q, idx) => {
          const isAnswered = !!answers[q.id];
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={`w-7 h-7 rounded border-2 font-heading text-xs transition-all flex items-center justify-center ${
                isCurrent
                  ? 'bg-punch-red text-cream border-ink scale-110 shadow-[2px_2px_0px_#171510] font-black'
                  : isAnswered
                  ? 'bg-victory-green text-cream border-ink font-bold'
                  : 'bg-white text-ink border-ink/40 hover:border-ink'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Main Question Card */}
      <div className="comic-box-lg bg-white p-6 sm:p-8 space-y-6">
        {/* Question Text */}
        <div className="space-y-2">
          <span className="font-comic text-xs uppercase bg-comic-yellow text-ink px-2 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510]">
            QUESTION #{currentIndex + 1}
          </span>
          <h3 className="font-sans font-bold text-lg sm:text-xl text-ink leading-relaxed">
            {currentQ.question_text}
          </h3>
        </div>

        {/* 4 Answer Option Cards */}
        <div className="space-y-3 pt-2">
          {currentQ.options?.map((opt, oIdx) => {
            const isSelected = answers[currentQ.id] === opt.id;
            const optionLabels = ['A', 'B', 'C', 'D'];
            const label = optionLabels[oIdx] || String(oIdx + 1);

            return (
              <div
                key={opt.id}
                onClick={() => handleSelectOption(currentQ.id, opt.id)}
                className={`comic-box p-4 cursor-pointer transition-all flex items-center gap-3 ${
                  isSelected
                    ? 'bg-comic-yellow border-ink shadow-[4px_4px_0px_#171510] -translate-y-0.5'
                    : 'bg-cream/60 hover:bg-cream border-ink/60 hover:border-ink'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-md font-heading text-base flex items-center justify-center border-2 border-ink flex-shrink-0 ${
                    isSelected ? 'bg-punch-red text-cream' : 'bg-white text-ink'
                  }`}
                >
                  {label}
                </div>
                <div className="font-sans text-sm text-ink font-medium leading-normal">
                  {opt.option_text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Buttons: Prev / Next / Final Submit */}
        <div className="pt-6 border-t-2 border-ink/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <ComicButton
              variant="white"
              size="md"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              PREV
            </ComicButton>

            <div className="font-mono text-xs text-olive-dark font-bold sm:hidden">
              {answeredCount} / {questions.length} ANSWERED
            </div>
          </div>

          <div className="font-mono text-xs text-olive-dark font-bold hidden sm:block">
            {answeredCount} / {questions.length} ANSWERED
          </div>

          <div className="w-full sm:w-auto">
            {currentIndex === questions.length - 1 ? (
              <ComicButton
                variant="red"
                size="md"
                className="w-full sm:w-auto"
                onClick={() => setConfirmModal(true)}
                loading={submitting}
                icon={<Send className="w-4 h-4" />}
              >
                FINALIZE BATTLE!
              </ComicButton>
            ) : (
              <ComicButton
                variant="yellow"
                size="md"
                className="w-full sm:w-auto"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              >
                NEXT QUESTION →
              </ComicButton>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog before Final Submission */}
      <ConfirmDialog
        isOpen={confirmModal}
        title="SUBMIT OFFICIAL ATTEMPT?"
        message={`You have answered ${answeredCount} of ${questions.length} questions. You cannot re-take this official challenge after submission.`}
        confirmText="YES, SUBMIT ANSWERS!"
        cancelText="KEEP ANSWERING"
        variant="red"
        onConfirm={handleSubmitQuiz}
        onCancel={() => setConfirmModal(false)}
      />
    </div>
  );
};

export default TakeQuiz;

