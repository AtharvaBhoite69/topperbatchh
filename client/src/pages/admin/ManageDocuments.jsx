import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { LoadingSkeleton, EmptyState } from '../../components/ui/ComicElements';
import { documents as docApi } from '../../services/api';
import { BookOpen, Upload, Trash2, Eye, EyeOff, Plus, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export const ManageDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Subject Modal
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectSem, setNewSubjectSem] = useState(1);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  useEffect(() => {
    fetchDocsAndMetadata();
  }, []);

  const fetchDocsAndMetadata = async () => {
    setLoading(true);
    try {
      const [docsRes, subsRes, semsRes] = await Promise.all([
        docApi.list({ limit: 100 }),
        docApi.getSubjects(),
        docApi.getSemesters(),
      ]);

      if (docsRes.data?.success) setDocuments(docsRes.data.documents || []);
      if (subsRes.data?.success) setSubjects(subsRes.data.subjects || []);
      if (semsRes.data?.success) setSemesters(semsRes.data.semesters || []);
    } catch (err) {
      toast.error('Failed to load documents vault.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (doc) => {
    const newVis = doc.is_visible === 1 ? 0 : 1;
    try {
      await docApi.update(doc.id, { is_visible: newVis });
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, is_visible: newVis } : d))
      );
      toast.success(`Document visibility ${newVis ? 'enabled' : 'hidden'}.`);
    } catch (err) {
      toast.error('Could not update visibility.');
    }
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm('Are you sure you want to permanently delete this PDF from storage?');
    if (!confirm) return;

    try {
      await docApi.delete(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.success('Document deleted from vault.');
    } catch (err) {
      toast.error('Failed to delete document.');
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    try {
      await docApi.createSubject({
        name: newSubjectName.trim(),
        code: newSubjectCode.trim(),
        semester_id: parseInt(newSubjectSem, 10),
      });

      toast.success('Subject created!');
      setNewSubjectName('');
      setNewSubjectCode('');
      setShowSubjectModal(false);
      fetchDocsAndMetadata();
    } catch (err) {
      toast.error('Could not create subject.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              DOCUMENT VAULT & NOTES
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Upload and organize previous year papers, unit question banks, and lecture summaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSubjectModal(true)}
            className="comic-btn comic-btn-white text-xs"
          >
            + NEW SUBJECT
          </button>
          <Link to="/admin/upload">
            <ComicButton variant="yellow" size="sm" icon={<Upload className="w-4 h-4" />}>
              UPLOAD PDF
            </ComicButton>
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon="📚"
          title="VAULT IS EMPTY"
          description="Upload your first question bank PDF to enable student studying and AI question-answering!"
          actionLabel="UPLOAD FIRST PDF"
          onAction={() => (window.location.href = '/admin/upload')}
        />
      ) : (
        <div className="comic-box bg-white overflow-hidden">
          <div className="divide-y-2 divide-ink/10">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-cream/40 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-comic text-[10px] bg-comic-yellow text-ink px-1.5 py-0.2 rounded border border-ink">
                      {doc.subject_name || 'General'}
                    </span>
                    <h4 className="font-heading text-lg uppercase text-ink">
                      {doc.title}
                    </h4>
                  </div>
                  <div className="text-[11px] font-mono text-olive-dark mt-0.5">
                    {doc.original_name} • {doc.page_count || 1} Pages • Sem {doc.semester_id || 'All'} • Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <Link to={`/document/${doc.id}`} target="_blank">
                    <ComicButton variant="white" size="sm" icon={<Eye className="w-3.5 h-3.5" />}>
                      VIEW
                    </ComicButton>
                  </Link>

                  <button
                    onClick={() => handleToggleVisibility(doc)}
                    className={`comic-btn text-xs px-2.5 py-1 ${
                      doc.is_visible ? 'comic-btn-olive' : 'comic-btn-yellow'
                    }`}
                  >
                    {doc.is_visible ? 'HIDE' : 'SHOW'}
                  </button>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="comic-btn comic-btn-red text-xs px-2.5 py-1"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Subject Modal */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="comic-box-lg max-w-md w-full bg-cream p-6 animate-in fade-in">
            <h3 className="font-heading text-2xl uppercase tracking-wide text-ink mb-4">
              CREATE NEW SUBJECT
            </h3>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
                  SUBJECT NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. Database Management Systems"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="comic-input text-xs py-2 bg-white"
                  required
                />
              </div>

              <div>
                <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
                  SUBJECT CODE (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CS302"
                  value={newSubjectCode}
                  onChange={(e) => setNewSubjectCode(e.target.value)}
                  className="comic-input text-xs py-2 bg-white"
                />
              </div>

              <div>
                <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
                  SEMESTER
                </label>
                <select
                  value={newSubjectSem}
                  onChange={(e) => setNewSubjectSem(e.target.value)}
                  className="comic-input text-xs py-2 bg-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="comic-btn comic-btn-white text-xs"
                >
                  CANCEL
                </button>
                <ComicButton type="submit" variant="yellow" size="sm">
                  SAVE SUBJECT
                </ComicButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageDocuments;

