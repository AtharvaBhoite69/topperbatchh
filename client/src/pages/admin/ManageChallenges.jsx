import React, { useState, useEffect } from 'react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import ComicInput from '../../components/ui/ComicInput';
import { LoadingSkeleton, EmptyState } from '../../components/ui/ComicElements';
import api from '../../services/api';
import { Zap, Plus, Calendar, Clock, Trophy, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const ManageChallenges = () => {
  const [challenges, setChallenges] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challengeDate, setChallengeDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [subjectId, setSubjectId] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const [cRes, qRes, sRes] = await Promise.all([
        api.get('/quiz/challenges'),
        api.get('/quiz/questions'),
        api.get('/documents/subjects'),
      ]);

      if (cRes.data?.success) setChallenges(cRes.data.challenges || []);
      if (qRes.data?.success) setQuestions(qRes.data.questions || []);
      if (sRes.data?.success) setSubjects(sRes.data.subjects || []);
    } catch (err) {
      toast.error('Failed to load challenges.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleQuestionSelect = (qId) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    if (!title.trim() || !challengeDate) {
      toast.error('Title and challenge date are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/quiz/challenges', {
        title: title.trim(),
        description: description.trim(),
        challenge_date: challengeDate,
        duration_minutes: parseInt(durationMinutes, 10),
        subject_id: subjectId || null,
        question_ids: selectedQuestionIds,
      });

      if (res.data?.success) {
        toast.success('Daily battle scheduled!');
        setShowModal(false);
        setTitle('');
        setDescription('');
        setSelectedQuestionIds([]);
        fetchChallenges();
      }
    } catch (err) {
      toast.error('Failed to schedule challenge.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChallenge = async (challenge) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${challenge.title}"? This will also remove student attempts for this battle.`
    );
    if (!confirmed) return;

    setDeletingId(challenge.id);
    try {
      const res = await api.delete(`/quiz/challenges/${challenge.id}`);
      if (res.data?.success) {
        setChallenges((prev) => prev.filter((item) => item.id !== challenge.id));
        toast.success(res.data.message || 'MCQ battle deleted.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.details || 'Failed to delete MCQ battle.';
      toast.error(errMsg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-6 h-6 text-punch-red fill-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              BATTLE PLANNER & MCQ SCHEDULER
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Schedule official daily battles, assign questions from the forge pool, and set countdown durations.
          </p>
        </div>

        <ComicButton
          variant="yellow"
          size="sm"
          onClick={() => setShowModal(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          SCHEDULE BATTLE
        </ComicButton>
      </div>

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : challenges.length === 0 ? (
        <EmptyState
          icon="⚡"
          title="NO CHALLENGES SCHEDULED"
          description="Create your first competition challenge to activate daily battles!"
          actionLabel="SCHEDULE FIRST BATTLE"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="space-y-3">
          {challenges.map((c) => (
            <div
              key={c.id}
              className="comic-box p-5 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-comic text-[10px] bg-punch-red text-cream px-1.5 py-0.2 rounded border border-ink">
                    {c.challenge_date}
                  </span>
                  <span className="font-comic text-[10px] bg-comic-yellow text-ink px-1.5 py-0.2 rounded border border-ink">
                    {c.subject_name || 'Mixed Subjects'}
                  </span>
                  {c.is_active === 1 && (
                    <span className="font-comic text-[10px] bg-victory-green text-cream px-1.5 py-0.2 rounded border border-ink">
                      ACTIVE LIVE
                    </span>
                  )}
                </div>

                <h3 className="font-heading text-xl uppercase tracking-wide text-ink">
                  {c.title}
                </h3>
                <div className="text-xs font-mono text-olive-dark mt-0.5">
                  Duration: {c.duration_minutes}m • Questions: {c.question_count || 0} • Attempts: {c.attempt_count || 0}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => handleDeleteChallenge(c)}
                  disabled={deletingId === c.id}
                  className="comic-btn comic-btn-red text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingId === c.id ? 'DELETING...' : 'DELETE'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Challenge Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="comic-box-lg max-w-xl w-full bg-cream p-6 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-heading text-2xl uppercase tracking-wide text-ink mb-4">
              SCHEDULE DAILY MCQ CHALLENGE
            </h3>

            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <ComicInput
                label="Battle Title"
                placeholder="e.g. DBMS & SQL Master Challenge #1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <ComicInput
                label="Description"
                textarea={true}
                rows={2}
                placeholder="Covers indexing, normal forms, and transaction ACID properties..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    DATE
                  </label>
                  <input
                    type="date"
                    value={challengeDate}
                    onChange={(e) => setChallengeDate(e.target.value)}
                    className="comic-input text-xs py-2 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    DURATION (MINS)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="comic-input text-xs py-2 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    SUBJECT
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="comic-input text-xs py-2 bg-white font-mono"
                  >
                    <option value="">Mixed</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Question Pool Selector */}
              <div className="space-y-2 pt-2">
                <label className="font-comic text-xs uppercase text-ink flex justify-between">
                  <span>SELECT QUESTIONS FROM FORGE POOL</span>
                  <span>{selectedQuestionIds.length} SELECTED</span>
                </label>

                <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 bg-white border-2 border-ink rounded">
                  {questions.length === 0 ? (
                    <p className="text-xs text-olive-dark p-2">No questions in forge pool yet.</p>
                  ) : (
                    questions.map((q) => {
                      const isSelected = selectedQuestionIds.includes(q.id);
                      return (
                        <div
                          key={q.id}
                          onClick={() => handleToggleQuestionSelect(q.id)}
                          className={`p-2 rounded border cursor-pointer text-xs flex items-center justify-between ${
                            isSelected
                              ? 'bg-comic-yellow border-ink font-bold'
                              : 'bg-cream/40 border-ink/20'
                          }`}
                        >
                          <span className="truncate pr-2">{q.question_text}</span>
                          <span className="font-comic text-[9px] uppercase">
                            {isSelected ? '✓ SELECTED' : '+ ADD'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="comic-btn comic-btn-white text-xs"
                >
                  CANCEL
                </button>
                <ComicButton type="submit" variant="yellow" size="sm" loading={saving}>
                  SCHEDULE BATTLE
                </ComicButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageChallenges;

