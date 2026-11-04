import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicInput from '../../components/ui/ComicInput';
import { documents as docApi } from '../../services/api';
import { Upload, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const UploadDocument = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [semesterId, setSemesterId] = useState(3);
  const [subjectId, setSubjectId] = useState('');
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [subRes, semRes] = await Promise.all([
          docApi.getSubjects(),
          docApi.getSemesters(),
        ]);
        if (subRes.data?.success) setSubjects(subRes.data.subjects || []);
        if (semRes.data?.success) setSemesters(semRes.data.semesters || []);
      } catch (e) {
        // ignore
      }
    };
    fetchMetadata();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.type !== 'application/pdf') {
        toast.error('Only PDF documents are allowed.');
        return;
      }
      setFile(selected);
      if (!title) {
        // Auto-fill title from filename
        setTitle(selected.name.replace(/\.pdf$/i, ''));
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a PDF file to upload.');
      return;
    }
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('semester_id', semesterId);
    if (subjectId) formData.append('subject_id', subjectId);
    if (topic) formData.append('topic', topic.trim());

    try {
      const res = await docApi.upload(formData);
      if (res.data?.success) {
        toast.success('PDF uploaded and RAG indexing started!');
        navigate('/admin/documents');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-left select-none">
      <Link to="/admin/documents">
        <ComicButton variant="white" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
          BACK TO VAULT
        </ComicButton>
      </Link>

      <div className="comic-box bg-white p-6">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="w-6 h-6 text-punch-red" />
          <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
            UPLOAD QUESTION BANK OR NOTES
          </h1>
        </div>
        <p className="font-sans text-xs text-olive-dark font-medium mb-6">
          Files are securely stored and automatically parsed into page text and vector embeddings for the Gemini AI chatbot.
        </p>

        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {/* File Picker with Comic Dashed Border */}
          <div className="comic-dashed-box p-6 text-center bg-cream/50 cursor-pointer hover:bg-cream transition-colors">
            <input
              type="file"
              accept="application/pdf"
              id="pdf-upload"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer block">
              <FileText className="w-12 h-12 text-punch-red mx-auto mb-2" />
              {file ? (
                <div>
                  <span className="font-heading text-base uppercase text-ink block">
                    {file.name}
                  </span>
                  <span className="font-mono text-xs text-victory-green font-bold">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • READY FOR UPLOAD ✓
                  </span>
                </div>
              ) : (
                <div>
                  <span className="font-heading text-lg uppercase text-ink block">
                    CLICK TO SELECT PDF FILE
                  </span>
                  <span className="font-sans text-xs text-olive-dark">
                    Max file size: 50MB • Strictly PDF format
                  </span>
                </div>
              )}
            </label>
          </div>

          <ComicInput
            label="Document Title"
            placeholder="e.g. Database Management Systems Unit 2 QB"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <ComicInput
            label="Description / Syllabus Topics Covered"
            textarea={true}
            rows={3}
            placeholder="Covers Relational Algebra, SQL queries, Normalization, and previous 5 years exam questions..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
                SEMESTER
              </label>
              <select
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
                className="comic-input text-xs py-2 bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
                SUBJECT
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="comic-input text-xs py-2 bg-white font-mono"
              >
                <option value="">General / Mixed Subject</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.code ? `(${sub.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ComicButton
            type="submit"
            variant="yellow"
            size="lg"
            className="w-full mt-4"
            loading={uploading}
            icon={<Upload className="w-5 h-5" />}
          >
            {uploading ? 'EXTRACTING PAGES & INDEXING RAG...' : 'UPLOAD & INDEX TO VAULT'}
          </ComicButton>
        </form>
      </div>
    </div>
  );
};

export default UploadDocument;

