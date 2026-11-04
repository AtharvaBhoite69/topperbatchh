import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Save,
  Rocket,
  Sliders,
  Check,
  FileText,
  HelpCircle,
  Calendar,
  ChevronDown,
  Layers,
  ArrowRight,
} from 'lucide-react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import ComicInput from '../../components/ui/ComicInput';
import { ComicBadge } from '../../components/ui/ComicElements';
import { mcqGenerator as mcqApi, documents as docApi, quiz as quizApi } from '../../services/api';
import toast from 'react-hot-toast';

export const MCQGenerator = () => {
  // Step 1: Configuration States
  const [sourceMode, setSourceMode] = useState('upload'); // 'upload' | 'vault'
  const [vaultDocuments, setVaultDocuments] = useState([]);
  const [selectedVaultDocId, setSelectedVaultDocId] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');

  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('mixed');
  const [questionStyle, setQuestionStyle] = useState('mixed');
  const [topic, setTopic] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  // Generation & Review States
  const [generating, setGenerating] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sourcePdfName, setSourcePdfName] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [summary, setSummary] = useState('');
  const [insufficientReason, setInsufficientReason] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);

  // Publish Modal States
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishType, setPublishType] = useState('challenge'); // 'challenge' | 'question_bank' | 'both'
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDate, setChallengeDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [scoringCorrect, setScoringCorrect] = useState(10);
  const [publishing, setPublishing] = useState(false);

  // Drafts drawer state
  const [drafts, setDrafts] = useState([]);
  const [showDraftsDrawer, setShowDraftsDrawer] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const fileInputRef = useRef(null);

  // Load existing vault documents on mount
  useEffect(() => {
    const fetchVaultDocs = async () => {
      try {
        const res = await docApi.list({ limit: 100 });
        if (res.data?.success) {
          setVaultDocuments(res.data.documents || []);
        }
      } catch (err) {
        console.error('Failed to load vault documents:', err);
      }
    };
    fetchVaultDocs();
  }, []);

  // Handle local file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Please upload a valid PDF document.');
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        toast.error('File size exceeds 30MB limit.');
        return;
      }
      setPdfFile(file);
      setPdfFileName(file.name);
    }
  };

  // Trigger AI Generation
  const handleGenerate = async (e) => {
    e?.preventDefault();

    if (sourceMode === 'upload' && !pdfFile) {
      toast.error('Please select a PDF document to upload.');
      return;
    }
    if (sourceMode === 'vault' && !selectedVaultDocId) {
      toast.error('Please select an existing Question Bank from your vault.');
      return;
    }

    setGenerating(true);
    setQuestions([]);
    setInsufficientReason(null);

    const formData = new FormData();
    if (sourceMode === 'upload') {
      formData.append('file', pdfFile);
    } else {
      formData.append('document_id', selectedVaultDocId);
    }
    formData.append('count', questionCount);
    formData.append('difficulty', difficulty);
    formData.append('question_style', questionStyle);
    formData.append('topic', topic.trim());
    formData.append('instructions', customInstructions.trim());

    try {
      const res = await mcqApi.generate(formData);
      if (res.data?.success) {
        setSessionId(res.data.sessionId);
        setSourcePdfName(res.data.sourcePdf);
        setPageCount(res.data.pageCount || 1);
        setSummary(res.data.summary || '');
        setInsufficientReason(res.data.insufficientContentReason);
        // By default, mark all valid generated questions as selected/approved in preview
        const initialQuestions = (res.data.questions || []).map((q) => ({
          ...q,
          is_approved: true,
        }));
        setQuestions(initialQuestions);
        toast.success(`💥 Forged ${initialQuestions.length} MCQs from "${res.data.sourcePdf}"!`);
      } else {
        toast.error(res.data?.error || 'Generation failed.');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'AI MCQ generation failed. Verify server Gemini key.';
      toast.error(errorMsg);
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate an individual question
  const handleRegenerateQuestion = async (index) => {
    const targetQ = questions[index];
    if (!targetQ) return;

    setRegeneratingIndex(index);
    try {
      const res = await mcqApi.regenerateQuestion({
        sessionId,
        document_id: sourceMode === 'vault' ? selectedVaultDocId : null,
        source_pdf_name: sourcePdfName,
        page_number: targetQ.source_page || 1,
        topic: targetQ.topic || topic,
        difficulty: targetQ.difficulty || difficulty,
        question_style: questionStyle,
        existing_question: targetQ.question,
        instructions: customInstructions,
      });

      if (res.data?.success && res.data.question) {
        const replacement = {
          ...res.data.question,
          is_approved: true,
        };
        setQuestions((prev) => prev.map((q, i) => (i === index ? replacement : q)));
        toast.success(`Question #${index + 1} regenerated!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to regenerate question.');
    } finally {
      setRegeneratingIndex(null);
    }
  };

  // Question editing handlers
  const handleUpdateQuestionText = (index, text) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, question: text } : q))
    );
  };

  const handleUpdateOptionText = (qIndex, optIndex, text) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const newOptions = q.options.map((opt, oi) =>
          oi === optIndex ? { ...opt, text } : opt
        );
        return { ...q, options: newOptions };
      })
    );
  };

  const handleSelectCorrectAnswer = (qIndex, label) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, correct_answer: label } : q))
    );
  };

  const handleUpdateExplanation = (index, explanation) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, explanation } : q))
    );
  };

  const handleToggleApproval = (index) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, is_approved: !q.is_approved } : q))
    );
  };

  const handleDeleteQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    toast.success('Question removed.');
  };

  // Bulk actions
  const handleSelectAll = (approveAll = true) => {
    setQuestions((prev) => prev.map((q) => ({ ...q, is_approved: approveAll })));
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!sessionId) {
      toast.error('No active session to save.');
      return;
    }
    try {
      await mcqApi.updateDraft(sessionId, { questions });
      toast.success('💾 Draft saved! You can resume editing anytime.');
    } catch (err) {
      toast.error('Failed to save draft.');
    }
  };

  // Load drafts list
  const handleOpenDrafts = async () => {
    setShowDraftsDrawer(true);
    setLoadingDrafts(true);
    try {
      const res = await mcqApi.getDrafts();
      if (res.data?.success) {
        setDrafts(res.data.drafts || []);
      }
    } catch (err) {
      toast.error('Could not load draft sessions.');
    } finally {
      setLoadingDrafts(false);
    }
  };

  // Resume a draft
  const handleResumeDraft = async (draftId) => {
    try {
      const res = await mcqApi.getDraft(draftId);
      if (res.data?.success && res.data.draft) {
        const d = res.data.draft;
        setSessionId(d.id);
        setSourcePdfName(d.source_pdf_name || 'Draft Material.pdf');
        setTopic(d.topic || '');
        setDifficulty(d.difficulty || 'mixed');
        setQuestionStyle(d.question_style || 'mixed');
        setQuestions((d.questions || []).map((q) => ({ ...q, is_approved: q.is_approved ?? true })));
        setShowDraftsDrawer(false);
        toast.success(`Resumed draft: "${d.source_pdf_name}"!`);
      }
    } catch (err) {
      toast.error('Failed to resume draft session.');
    }
  };

  // Final Publish Handler (Admin Approval Enforced)
  const handlePublish = async () => {
    const approvedList = questions.filter((q) => q.is_approved);
    if (approvedList.length === 0) {
      toast.error('No approved questions selected! Check at least one question to publish.');
      return;
    }

    setPublishing(true);
    try {
      const res = await mcqApi.publish({
        sessionId,
        publishType,
        challengeTitle: challengeTitle.trim() || undefined,
        challengeDate,
        durationMinutes,
        scoringCorrect,
        subjectId: null,
        approvedQuestions: approvedList,
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Successfully published!');
        setShowPublishModal(false);
        // Reset or mark published
        setQuestions((prev) =>
          prev.map((q) => (q.is_approved ? { ...q, published: true } : q))
        );
      } else {
        toast.error(res.data?.error || 'Publishing failed.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to publish questions.');
    } finally {
      setPublishing(false);
    }
  };

  const approvedCount = questions.filter((q) => q.is_approved).length;

  return (
    <div className="space-y-6 text-left selection:bg-comic-yellow selection:text-ink">
      {/* Header Banner */}
      <div className="comic-box bg-white p-5 sm:p-7 relative overflow-hidden shadow-[6px_6px_0px_#171510]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-punch-red text-cream font-comic text-xs uppercase px-3 py-1 rounded border-2 border-ink shadow-[2px_2px_0px_#171510] -rotate-1 mb-2 font-bold tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ADMIN COMMAND ONLY // AI MCQ FORGE</span>
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tight text-ink drop-shadow-[2px_2px_0px_#B8B0A0]">
              PDF-TO-MCQ <span className="text-punch-red">GENERATOR</span>
            </h1>
            <p className="font-sans text-xs sm:text-sm text-vintage-olive font-medium mt-1 max-w-2xl">
              Upload any semester question bank or syllabus PDF. Gemini analyzes the pages and generates verified MCQs with exact page citations, 4 options, and explanations. Review, edit, and approve before publishing!
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <ComicButton
              variant="white"
              size="sm"
              onClick={handleOpenDrafts}
              icon={<Save className="w-4 h-4" />}
            >
              SAVED DRAFTS
            </ComicButton>
          </div>
        </div>
      </div>

      {/* Step 1: Config & Upload Form */}
      <div className="comic-box bg-cream p-5 sm:p-7 border-[4px] shadow-[6px_6px_0px_#171510]">
        <h2 className="font-heading text-xl uppercase tracking-wide text-ink mb-4 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-punch-red" />
          <span>1. SOURCE MATERIAL & AI GENERATION CONFIG</span>
        </h2>

        {/* Source Mode Toggle: Upload New vs Select from Vault */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setSourceMode('upload')}
            className={`font-comic text-xs sm:text-sm uppercase px-4 py-2 rounded border-2 border-ink transition-all flex items-center gap-2 ${
              sourceMode === 'upload'
                ? 'bg-comic-yellow text-ink font-bold shadow-[3px_3px_0px_#171510] -translate-y-0.5'
                : 'bg-white text-ink/70 hover:bg-cream'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>UPLOAD NEW PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceMode('vault')}
            className={`font-comic text-xs sm:text-sm uppercase px-4 py-2 rounded border-2 border-ink transition-all flex items-center gap-2 ${
              sourceMode === 'vault'
                ? 'bg-comic-yellow text-ink font-bold shadow-[3px_3px_0px_#171510] -translate-y-0.5'
                : 'bg-white text-ink/70 hover:bg-cream'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>SELECT FROM VAULT ({vaultDocuments.length} PDFs)</span>
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          {sourceMode === 'upload' ? (
            <div>
              <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
                ATTACH EXAM PDF DOCUMENT (MAX 30MB):
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="comic-box-sm p-5 bg-white text-center cursor-pointer border-dashed hover:bg-comic-yellow/10 transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />
                <FileText className="w-8 h-8 text-punch-red mx-auto mb-2" />
                {pdfFileName ? (
                  <div className="font-mono text-xs font-bold text-ink">
                    📄 Selected: <span className="text-punch-red">{pdfFileName}</span>
                    <span className="block font-sans text-[11px] text-olive-dark font-normal mt-0.5">
                      Click to change PDF
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-comic text-sm uppercase text-ink block">
                      CLICK TO BROWSE OR DRAG PDF HERE
                    </span>
                    <span className="font-sans text-xs text-olive-dark block mt-1">
                      Supports question banks, syllabus manuals, exam blueprints & lecture notes.
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
                SELECT EXISTING VAULT PDF:
              </label>
              <select
                value={selectedVaultDocId}
                onChange={(e) => setSelectedVaultDocId(e.target.value)}
                className="comic-input text-xs sm:text-sm bg-white font-mono py-2.5"
              >
                <option value="">-- Choose a Question Bank / Material --</option>
                {vaultDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.page_count || 1} pages)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                QUESTION COUNT:
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
                className="comic-input text-xs sm:text-sm bg-white font-mono"
              >
                <option value={5}>5 Questions (Quick Quiz)</option>
                <option value={10}>10 Questions (Standard Battle)</option>
                <option value={15}>15 Questions (Deep Exam Prep)</option>
                <option value={20}>20 Questions (Grand Mock Test)</option>
              </select>
            </div>

            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                DIFFICULTY:
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="comic-input text-xs sm:text-sm bg-white font-mono"
              >
                <option value="mixed">Mixed (Recommended)</option>
                <option value="easy">Easy (Fundamentals)</option>
                <option value="medium">Medium (Standard Sem Exam)</option>
                <option value="hard">Hard (9-Pointer Topper Level)</option>
              </select>
            </div>

            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                QUESTION STYLE:
              </label>
              <select
                value={questionStyle}
                onChange={(e) => setQuestionStyle(e.target.value)}
                className="comic-input text-xs sm:text-sm bg-white font-mono"
              >
                <option value="mixed">Mixed (Recommended)</option>
                <option value="conceptual">Conceptual Understanding</option>
                <option value="definition-based">Definitions & Formulas</option>
                <option value="application-based">Applied & Numerical Problems</option>
              </select>
            </div>

            <div>
              <label className="font-comic text-xs uppercase text-ink block mb-1">
                TOPIC / CHAPTER (OPTIONAL):
              </label>
              <input
                type="text"
                placeholder="e.g. Module 3: Indexing & B-Trees"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="comic-input text-xs sm:text-sm bg-white"
              />
            </div>
          </div>

          <div>
            <label className="font-comic text-xs uppercase text-ink block mb-1">
              CUSTOM AI INSTRUCTIONS (OPTIONAL):
            </label>
            <input
              type="text"
              placeholder="e.g. Focus on previous year Mumbai University question styles, avoid introductory definitions."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="comic-input text-xs sm:text-sm bg-white"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <ComicButton
              type="submit"
              variant="yellow"
              size="lg"
              disabled={generating}
              loading={generating}
              icon={<Sparkles className="w-5 h-5 text-punch-red" />}
            >
              {generating ? 'ANALYZING PDF & FORGING MCQs...' : '⚡ FORGE MCQs WITH GEMINI AI'}
            </ComicButton>
          </div>
        </form>
      </div>

      {/* Generation Warning if insufficient content */}
      {insufficientReason && (
        <div className="comic-box p-4 bg-white border-punch-red flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-punch-red flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-comic text-xs uppercase text-punch-red font-bold block">
              CONTENT NOTICE FROM AI FORGE:
            </span>
            <p className="font-sans text-xs text-ink/80 font-medium mt-0.5">
              {insufficientReason}
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Interactive Review & Edit Arena */}
      {questions.length > 0 && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="comic-box bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[4px_4px_0px_#171510]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-xl uppercase tracking-wide text-ink">
                  2. REVIEW & APPROVE ({questions.length} QUESTIONS)
                </span>
                <span className="font-comic text-xs bg-victory-green text-cream px-2 py-0.5 rounded border border-ink font-bold">
                  {approvedCount} APPROVED
                </span>
              </div>
              <p className="font-mono text-xs text-olive-dark mt-0.5 truncate max-w-xl">
                Source: <strong>{sourcePdfName}</strong> • {pageCount} pages analyzed
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(approvedCount < questions.length)}
                className="comic-btn comic-btn-white text-xs px-3 py-1.5 font-comic"
              >
                {approvedCount === questions.length ? 'DESELECT ALL' : 'APPROVE ALL'}
              </button>

              <ComicButton
                variant="white"
                size="sm"
                onClick={handleSaveDraft}
                icon={<Save className="w-3.5 h-3.5" />}
              >
                SAVE DRAFT
              </ComicButton>

              <ComicButton
                variant="red"
                size="sm"
                onClick={() => setShowPublishModal(true)}
                disabled={approvedCount === 0}
                icon={<Rocket className="w-3.5 h-3.5" />}
              >
                PUBLISH ({approvedCount}) 🚀
              </ComicButton>
            </div>
          </div>

          {/* Question Cards List */}
          <div className="space-y-4">
            {questions.map((q, qIndex) => (
              <div
                key={q.id || qIndex}
                className={`comic-box p-4 sm:p-5 transition-all ${
                  q.is_approved
                    ? 'bg-white border-ink shadow-[4px_4px_0px_#171510]'
                    : 'bg-white/60 border-ink/40 opacity-75'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b-2 border-ink/15">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading text-lg sm:text-xl text-ink">
                      #{qIndex + 1}
                    </span>

                    <span className="font-comic text-[11px] uppercase bg-comic-yellow text-ink px-2 py-0.5 rounded border border-ink font-bold">
                      {q.difficulty}
                    </span>

                    <span className="font-mono text-[10px] bg-cream text-ink px-2 py-0.5 rounded border border-ink/40 flex items-center gap-1 font-semibold">
                      <FileText className="w-3 h-3 text-punch-red" />
                      <span>Page {q.source_page || 1}</span>
                    </span>

                    {q.topic && (
                      <span className="font-sans text-[11px] text-olive-dark font-semibold truncate max-w-[200px]">
                        🏷️ {q.topic}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Approve Checkbox */}
                    <label className="flex items-center gap-1.5 cursor-pointer font-comic text-xs uppercase font-bold select-none">
                      <input
                        type="checkbox"
                        checked={q.is_approved}
                        onChange={() => handleToggleApproval(qIndex)}
                        className="w-4 h-4 accent-victory-green cursor-pointer"
                      />
                      <span className={q.is_approved ? 'text-victory-green' : 'text-ink/60'}>
                        {q.is_approved ? 'APPROVED' : 'UNAPPROVED'}
                      </span>
                    </label>

                    {/* Regenerate this question */}
                    <button
                      type="button"
                      onClick={() => handleRegenerateQuestion(qIndex)}
                      disabled={regeneratingIndex === qIndex}
                      className="p-1.5 rounded border border-ink hover:bg-comic-yellow transition-colors"
                      title="Regenerate question with AI"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          regeneratingIndex === qIndex ? 'animate-spin text-punch-red' : 'text-ink'
                        }`}
                      />
                    </button>

                    {/* Delete question */}
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(qIndex)}
                      className="p-1.5 rounded border border-ink hover:bg-punch-red hover:text-cream transition-colors text-ink/70"
                      title="Delete question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Question Text Field (Inline Editable) */}
                <div className="mb-4">
                  <label className="font-comic text-[11px] uppercase text-ink/70 block mb-1">
                    QUESTION STATEMENT (EDITABLE):
                  </label>
                  <textarea
                    rows={2}
                    value={q.question}
                    onChange={(e) => handleUpdateQuestionText(qIndex, e.target.value)}
                    className="comic-input text-xs sm:text-sm bg-cream font-medium font-sans w-full"
                  />
                </div>

                {/* 4 Options Grid with Correct Answer Selection */}
                <div className="space-y-2 mb-4">
                  <label className="font-comic text-[11px] uppercase text-ink/70 flex items-center justify-between">
                    <span>ANSWER OPTIONS (CLICK RADIO TO SET CORRECT ANSWER):</span>
                    <span className="font-bold text-punch-red font-mono">
                      CORRECT: OPTION {q.correct_answer}
                    </span>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {q.options.map((opt, optIndex) => {
                      const isCorrect = (q.correct_answer || 'A').toUpperCase() === opt.label;
                      return (
                        <div
                          key={opt.label || optIndex}
                          className={`flex items-center gap-2 p-2 rounded border-2 transition-all ${
                            isCorrect
                              ? 'bg-victory-green/10 border-victory-green shadow-[2px_2px_0px_#171510]'
                              : 'bg-cream/40 border-ink/30'
                          }`}
                        >
                          <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                            <input
                              type="radio"
                              name={`correct_${q.id || qIndex}`}
                              checked={isCorrect}
                              onChange={() => handleSelectCorrectAnswer(qIndex, opt.label)}
                              className="accent-victory-green w-4 h-4 cursor-pointer"
                            />
                            <span
                              className={`font-heading text-sm px-1.5 py-0.5 rounded border ${
                                isCorrect
                                  ? 'bg-victory-green text-cream border-ink font-bold'
                                  : 'bg-white text-ink border-ink/40'
                              }`}
                            >
                              {opt.label}
                            </span>
                          </label>

                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => handleUpdateOptionText(qIndex, optIndex, e.target.value)}
                            className="comic-input text-xs bg-white py-1 font-sans flex-1"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation (Inline Editable) */}
                <div>
                  <label className="font-comic text-[11px] uppercase text-ink/70 block mb-1">
                    EXPLANATION & PROOF:
                  </label>
                  <textarea
                    rows={2}
                    value={q.explanation}
                    onChange={(e) => handleUpdateExplanation(qIndex, e.target.value)}
                    className="comic-input text-xs bg-cream font-mono w-full"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Publish CTA */}
          <div className="comic-box bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[4px_4px_0px_#171510]">
            <div>
              <span className="font-heading text-lg uppercase text-ink block">
                READY TO ACTIVATE FOR STUDENTS?
              </span>
              <span className="font-sans text-xs text-olive-dark">
                {approvedCount} of {questions.length} questions approved for publication.
              </span>
            </div>

            <ComicButton
              variant="red"
              size="lg"
              onClick={() => setShowPublishModal(true)}
              disabled={approvedCount === 0}
              icon={<Rocket className="w-5 h-5" />}
            >
              LAUNCH TO ARENA ({approvedCount} MCQs) 🚀
            </ComicButton>
          </div>
        </div>
      )}

      {/* Publish Modal Dialog */}
      {showPublishModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="comic-box-lg bg-cream border-[4px] border-ink shadow-[10px_10px_0px_#171510] max-w-lg w-full p-6 relative">
            <h3 className="font-heading text-2xl uppercase tracking-wide text-ink mb-1 flex items-center gap-2">
              <Rocket className="w-6 h-6 text-punch-red" />
              <span>PUBLISH APPROVED MCQs</span>
            </h3>
            <p className="font-sans text-xs text-olive-dark mb-4">
              {approvedCount} approved question(s) will be locked into the database for student battles.
            </p>

            <div className="space-y-4">
              <div>
                <label className="font-comic text-xs uppercase text-ink block mb-1">
                  DESTINATION:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPublishType('challenge')}
                    className={`p-2.5 rounded border-2 font-comic text-xs uppercase text-left transition-all ${
                      publishType === 'challenge'
                        ? 'bg-comic-yellow border-ink font-bold shadow-[2px_2px_0px_#171510]'
                        : 'bg-white border-ink/40'
                    }`}
                  >
                    🔥 DAILY CHALLENGE
                    <span className="block font-sans text-[10px] text-olive-dark font-normal">
                      Appears in student Daily MCQ Battle
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPublishType('question_bank')}
                    className={`p-2.5 rounded border-2 font-comic text-xs uppercase text-left transition-all ${
                      publishType === 'question_bank'
                        ? 'bg-comic-yellow border-ink font-bold shadow-[2px_2px_0px_#171510]'
                        : 'bg-white border-ink/40'
                    }`}
                  >
                    📚 QUESTION BANK
                    <span className="block font-sans text-[10px] text-olive-dark font-normal">
                      Stored in Question Forge bank
                    </span>
                  </button>
                </div>
              </div>

              {publishType === 'challenge' && (
                <>
                  <div>
                    <label className="font-comic text-xs uppercase text-ink block mb-1">
                      CHALLENGE TITLE:
                    </label>
                    <input
                      type="text"
                      placeholder={`Daily Battle: ${topic || 'Syllabus Sprint'}`}
                      value={challengeTitle}
                      onChange={(e) => setChallengeTitle(e.target.value)}
                      className="comic-input text-xs sm:text-sm bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-comic text-xs uppercase text-ink block mb-1">
                        COMPETITION DATE:
                      </label>
                      <input
                        type="date"
                        value={challengeDate}
                        onChange={(e) => setChallengeDate(e.target.value)}
                        className="comic-input text-xs bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-comic text-xs uppercase text-ink block mb-1">
                        TIME LIMIT (MINS):
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={60}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        className="comic-input text-xs bg-white font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-3 border-t-2 border-ink/20 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  disabled={publishing}
                  className="comic-btn comic-btn-white text-xs px-4 py-2 font-comic"
                >
                  CANCEL
                </button>

                <ComicButton
                  variant="yellow"
                  size="md"
                  onClick={handlePublish}
                  loading={publishing}
                  disabled={publishing}
                  icon={<Check className="w-4 h-4 text-victory-green" />}
                >
                  CONFIRM & PUBLISH!
                </ComicButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Drafts Drawer Modal */}
      {showDraftsDrawer && (
        <div
          className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="comic-box-lg bg-cream border-[4px] border-ink shadow-[10px_10px_0px_#171510] max-w-lg w-full p-6 relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-ink/20">
              <h3 className="font-heading text-xl uppercase tracking-wide text-ink">
                SAVED MCQ GENERATOR DRAFTS
              </h3>
              <button
                onClick={() => setShowDraftsDrawer(false)}
                className="text-xs font-comic text-punch-red font-bold hover:underline"
              >
                ✕ CLOSE
              </button>
            </div>

            {loadingDrafts ? (
              <div className="py-8 text-center font-comic text-xs animate-pulse">
                LOADING DRAFTS...
              </div>
            ) : drafts.length === 0 ? (
              <div className="py-8 text-center text-xs text-olive-dark font-sans">
                No saved drafts yet. Generate questions above and click "Save Draft".
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    className="comic-box-sm p-3 bg-white flex items-center justify-between gap-3 text-left hover:bg-comic-yellow/20 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="font-heading text-sm text-ink truncate block">
                        {d.source_pdf_name}
                      </span>
                      <span className="font-mono text-[10px] text-olive-dark block">
                        {d.question_count} MCQs • {d.difficulty} • {d.status} • {d.updated_at?.slice(0, 10)}
                      </span>
                    </div>

                    <ComicButton
                      variant="yellow"
                      size="sm"
                      onClick={() => handleResumeDraft(d.id)}
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      RESUME
                    </ComicButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MCQGenerator;
