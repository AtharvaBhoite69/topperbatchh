import React, { useState, useEffect } from 'react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import ComicInput from '../../components/ui/ComicInput';
import { LoadingSkeleton, EmptyState } from '../../components/ui/ComicElements';
import api from '../../services/api';
import { ListChecks, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const ManageQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [subjectId, setSubjectId] = useState('');
  const [options, setOptions] = useState([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const [qRes, subRes] = await Promise.all([
        api.get('/quiz/questions'),
        api.get('/documents/subjects'),
      ]);

      if (qRes.data?.success) setQuestions(qRes.data.questions || []);
      if (subRes.data?.success) setSubjects(subRes.data.subjects || []);
    } catch (err) {
      toast.error('Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (idx, text) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === idx ? { ...opt, text } : opt))
    );
  };

  const handleSetCorrectOption = (idx) => {
    setOptions((prev) =>
      prev.map((opt, i) => ({ ...opt, isCorrect: i === idx }))
    );
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!questionText.trim()) {
      toast.error('Question text is required.');
      return;
    }
    if (options.some((o) => !o.text.trim())) {
      toast.error('All 4 option choices must have text.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/quiz/questions', {
        question_text: questionText.trim(),
        explanation: explanation.trim(),
        difficulty,
        subject_id: subjectId || null,
        options,
      });

      if (res.data?.success) {
        toast.success('Question forged successfully!');
        setShowModal(false);
        setQuestionText('');
        setExplanation('');
        setOptions([
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
        ]);
        fetchQuestions();
      }
    } catch (err) {
      toast.error('Failed to create question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              QUESTION FORGE & MCQ POOL
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Create syllabus questions and 4 options with exact explanations for daily challenges.
          </p>
        </div>

        <ComicButton
          variant="yellow"
          size="sm"
          onClick={() => setShowModal(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          FORGE NEW MCQ
        </ComicButton>
      </div>

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : questions.length === 0 ? (
        <EmptyState
          icon="📝"
          title="NO QUESTIONS IN POOL"
          description="Create your first MCQ question to use in scheduled daily battles!"
          actionLabel="FORGE FIRST QUESTION"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="comic-box p-5 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-comic text-xs uppercase bg-comic-yellow text-ink px-2 py-0.5 rounded border border-ink">
                  {q.subject_name || 'General'} • {q.difficulty.toUpperCase()}
                </span>
                <span className="font-mono text-[10px] text-ink/60">
                  ID: {q.id.slice(0, 8)}
                </span>
              </div>

              <h4 className="font-sans font-bold text-sm text-ink">
                {q.question_text}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
                {q.options?.map((opt, oIdx) => (
                  <div
                    key={opt.id || oIdx}
                    className={`p-2 rounded border flex items-center justify-between ${
                      opt.is_correct
                        ? 'bg-victory-green/15 border-victory-green font-bold text-ink'
                        : 'bg-cream/40 border-ink/20 text-ink/80'
                    }`}
                  >
                    <span>{opt.option_text}</span>
                    {opt.is_correct === 1 && (
                      <span className="font-comic text-[9px] bg-victory-green text-cream px-1 rounded">
                        CORRECT ✓
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {q.explanation && (
                <div className="text-[11px] font-sans text-olive-dark italic border-l-2 border-punch-red pl-2 mt-1">
                  Explanation: {q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Forge MCQ Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="comic-box-lg max-w-xl w-full bg-cream p-6 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-heading text-2xl uppercase tracking-wide text-ink mb-4">
              FORGE NEW MCQ QUESTION
            </h3>

            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <ComicInput
                label="Question Text"
                textarea={true}
                rows={3}
                placeholder="e.g. Which of the following normal forms deals with multivalued dependency?"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-comic text-xs uppercase text-ink block mb-1">
                    DIFFICULTY
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="comic-input text-xs py-2 bg-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
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
                    <option value="">General</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4 Options Input with Radio for Correct Option */}
              <div className="space-y-2 pt-2">
                <label className="font-comic text-xs uppercase text-ink block">
                  4 OPTIONS (CLICK RADIO TO SET THE CORRECT ANSWER)
                </label>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={opt.isCorrect}
                      onChange={() => handleSetCorrectOption(idx)}
                      className="w-4 h-4 text-punch-red cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder={`Option ${['A', 'B', 'C', 'D'][idx]}`}
                      value={opt.text}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className={`comic-input text-xs py-1.5 ${
                        opt.isCorrect ? 'border-victory-green ring-1 ring-victory-green' : 'bg-white'
                      }`}
                      required
                    />
                  </div>
                ))}
              </div>

              <ComicInput
                label="Explanation & Exam Tips (shown in review)"
                textarea={true}
                rows={2}
                placeholder="4NF removes multi-valued dependencies that are not functional dependencies..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="comic-btn comic-btn-white text-xs"
                >
                  CANCEL
                </button>
                <ComicButton type="submit" variant="yellow" size="sm" loading={saving}>
                  SAVE MCQ
                </ComicButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageQuestions;

