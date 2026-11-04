import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { documents as docApi } from '../../services/api';
import ComicButton from '../../components/ui/ComicButton';
import { ArrowLeft, Bot, Bookmark, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const PDFViewer = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await docApi.get(id);
        if (res.data?.success && res.data?.document) {
          setDoc(res.data.document);
          setIsSaved(res.data.document.is_saved === 1);
        }
      } catch (err) {
        toast.error('Document not accessible or does not exist.');
        navigate('/question-bank');
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [id, navigate]);

  const handleToggleSave = async () => {
    try {
      if (isSaved) {
        await docApi.unsave(id);
        setIsSaved(false);
        toast.success('Removed from saved items.');
      } else {
        await docApi.save(id);
        setIsSaved(true);
        toast.success('Saved to your vault!');
      }
    } catch (err) {
      toast.error('Could not update saved status.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="font-comic text-2xl text-ink animate-bounce">
          ⚡ LOADING SECURE DOCUMENT VAULT...
        </div>
      </div>
    );
  }

  if (!doc) return null;

  const pdfUrl = `/api/documents/${id}/view`;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-3 select-none">
      {/* Top Controls Bar */}
      <div className="comic-box bg-white p-3.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/question-bank">
            <ComicButton variant="white" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              BACK
            </ComicButton>
          </Link>
          <div className="text-left">
            <h1 className="font-heading text-lg sm:text-xl uppercase tracking-wide text-ink truncate max-w-md">
              {doc.title}
            </h1>
            <div className="font-mono text-[11px] text-olive-dark">
              {doc.subject_name || 'General'} {doc.unit_name ? `• ${doc.unit_name}` : ''} • Sem {doc.semester_id || 'All'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSave}
            className={`p-2 rounded border-2 border-ink shadow-[2px_2px_0px_#171510] font-comic text-xs uppercase flex items-center gap-1.5 transition-colors ${
              isSaved ? 'bg-punch-red text-cream' : 'bg-cream text-ink hover:bg-comic-yellow'
            }`}
          >
            <Bookmark className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">{isSaved ? 'SAVED' : 'BOOKMARK'}</span>
          </button>

          <Link to={`/ai-chat?doc=${doc.id}`}>
            <ComicButton variant="yellow" size="sm" icon={<Bot className="w-4 h-4" />}>
              ASK AI ABOUT THIS PDF
            </ComicButton>
          </Link>
        </div>
      </div>

      {/* Security Deterrent Notice */}
      <div className="bg-comic-yellow/30 border-2 border-ink px-3 py-1 rounded text-[11px] font-mono text-ink flex items-center justify-between flex-shrink-0">
        <span className="flex items-center gap-1.5 font-bold">
          <ShieldAlert className="w-3.5 h-3.5 text-punch-red" />
          PROTECTED STUDENT VAULT: Watermarked for {user?.email}
        </span>
        <span className="hidden md:inline text-ink/70">
          Unauthorized redistribution is tracked and subject to disciplinary action.
        </span>
      </div>

      {/* PDF Viewer Container with Deterrent Watermark Overlay */}
      <div
        className="comic-box relative flex-1 bg-white overflow-hidden p-0 border-[3px] border-ink shadow-[6px_6px_0px_#171510]"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Dynamic Watermark Grid */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden flex flex-wrap gap-24 p-8 opacity-[0.07] select-none">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="transform -rotate-45 font-mono text-xs font-black text-ink whitespace-nowrap">
              {user?.full_name} ({user?.email}) • TOPPERBATCH PRIVATE
            </div>
          ))}
        </div>

        {/* Embedded PDF iframe */}
        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          title={doc.title}
          className="w-full h-full border-none relative z-10"
        />
      </div>
    </div>
  );
};

export default PDFViewer;

