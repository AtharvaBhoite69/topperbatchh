import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ComicCard from '../../components/ui/ComicCard';
import ComicButton from '../../components/ui/ComicButton';
import ComicInput from '../../components/ui/ComicInput';
import { ComicBadge, EmptyState, LoadingSkeleton } from '../../components/ui/ComicElements';
import { documents as docApi } from '../../services/api';
import { BookOpen, Search, Bookmark, Bot, Eye, Calendar, FileText, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export const QuestionBank = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Load initial dropdowns
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [semRes, subRes] = await Promise.all([
          docApi.getSemesters(),
          docApi.getSubjects(),
        ]);
        if (semRes.data?.success) setSemesters(semRes.data.semesters || []);
        if (subRes.data?.success) setSubjects(subRes.data.subjects || []);
      } catch (err) {
        console.error('Metadata load error:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch documents when filters change
  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
      try {
        const res = await docApi.list({
          search,
          semester: selectedSemester,
          subject_id: selectedSubject,
          page,
          limit: 12,
        });

        if (res.data?.success) {
          setDocuments(res.data.documents || []);
          setTotalPages(res.data.pagination?.pages || 1);
        }
      } catch (err) {
        toast.error('Failed to load documents.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, [search, selectedSemester, selectedSubject, page]);

  const handleToggleSave = async (docId, isCurrentlySaved) => {
    try {
      if (isCurrentlySaved) {
        await docApi.unsave(docId);
        toast.success('Removed from saved items.');
      } else {
        await docApi.save(docId);
        toast.success('Saved to your vault!');
      }

      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, is_saved: isCurrentlySaved ? 0 : 1 } : d))
      );
    } catch (err) {
      toast.error('Could not update saved status.');
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              QUESTION BANK & MATERIALS VAULT
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Verified study materials, previous question papers, and high-yield notes.
            Open any document to study in our protected viewer or ask AI instant questions with page references.
          </p>
        </div>

        <ComicBadge variant="yellow" className="text-xs">
          {documents.length} MATERIALS READY
        </ComicBadge>
      </div>

      {/* Filter & Search Bar */}
      <div className="comic-box bg-cream p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink pointer-events-none" />
          <input
            type="text"
            placeholder="Search topic or title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="comic-input text-xs pl-9 pr-3 py-2 bg-white"
          />
        </div>

        {/* Semester Filter */}
        <div>
          <select
            value={selectedSemester}
            onChange={(e) => {
              setSelectedSemester(e.target.value);
              setPage(1);
            }}
            className="comic-input text-xs py-2 bg-white font-mono"
          >
            <option value="">All Semesters</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                Semester {s.number} ({s.name})
              </option>
            ))}
          </select>
        </div>

        {/* Subject Filter */}
        <div>
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setPage(1);
            }}
            className="comic-input text-xs py-2 bg-white font-mono"
          >
            <option value="">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name} {sub.code ? `(${sub.code})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <LoadingSkeleton count={6} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon="📚"
          title="NO DOCUMENTS FOUND"
          description="Try broadening your search or choosing a different semester/subject."
          actionLabel="RESET FILTERS"
          onAction={() => {
            setSearch('');
            setSelectedSemester('');
            setSelectedSubject('');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => (
            <ComicCard
              key={doc.id}
              accent="yellow"
              className="bg-white p-5 flex flex-col justify-between"
            >
              <div>
                {/* Subject & Bookmark Row */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-comic text-[11px] bg-comic-yellow text-ink px-2 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510] uppercase truncate max-w-[70%]">
                    {doc.subject_name || 'General'} {doc.unit_name ? `• ${doc.unit_name}` : ''}
                  </span>
                  <button
                    onClick={() => handleToggleSave(doc.id, doc.is_saved === 1)}
                    className={`p-1.5 rounded border border-ink shadow-[1px_1px_0px_#171510] transition-colors ${
                      doc.is_saved
                        ? 'bg-punch-red text-cream'
                        : 'bg-cream text-ink hover:bg-comic-yellow'
                    }`}
                    title={doc.is_saved ? 'Remove bookmark' : 'Bookmark PDF'}
                  >
                    <Bookmark className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>

                {/* Title */}
                <h3 className="font-heading text-xl uppercase tracking-wide text-ink line-clamp-2 mt-1">
                  {doc.title}
                </h3>

                {/* Topic / Description */}
                {doc.description && (
                  <p className="font-sans text-xs text-olive-dark mt-1 line-clamp-2 font-medium">
                    {doc.description}
                  </p>
                )}

                {/* Metadata badges */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-mono text-ink/70">
                  <span className="bg-cream px-1.5 py-0.5 border border-ink/40 rounded flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {doc.page_count || 1} Pages
                  </span>
                  <span className="bg-cream px-1.5 py-0.5 border border-ink/40 rounded flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons: View & Ask AI */}
              <div className="mt-5 pt-3 border-t-2 border-ink/15 grid grid-cols-2 gap-2">
                <Link to={`/document/${doc.id}`}>
                  <ComicButton variant="yellow" size="sm" className="w-full text-xs" icon={<Eye className="w-3.5 h-3.5" />}>
                    VIEW PDF
                  </ComicButton>
                </Link>

                <Link to={`/ai-chat?doc=${doc.id}`}>
                  <ComicButton variant="olive" size="sm" className="w-full text-xs" icon={<Bot className="w-3.5 h-3.5" />}>
                    ASK AI
                  </ComicButton>
                </Link>
              </div>
            </ComicCard>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <ComicButton
            variant="white"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            PREV
          </ComicButton>
          <span className="font-heading text-sm text-ink px-3">
            PAGE {page} OF {totalPages}
          </span>
          <ComicButton
            variant="white"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            NEXT
          </ComicButton>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;

