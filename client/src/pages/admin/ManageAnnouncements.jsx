import React, { useState, useEffect } from 'react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import ComicInput from '../../components/ui/ComicInput';
import { EmptyState, LoadingSkeleton } from '../../components/ui/ComicElements';
import { admin as adminApi } from '../../services/api';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const ManageAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('normal');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAnnouncements();
      if (res.data?.success) {
        setAnnouncements(res.data.announcements || []);
      }
    } catch (err) {
      toast.error('Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSaving(true);
    try {
      const res = await adminApi.createAnnouncement({
        title: title.trim(),
        content: content.trim(),
        priority,
      });

      if (res.data?.success) {
        toast.success('Announcement broadcasted to entire batch!');
        setShowModal(false);
        setTitle('');
        setContent('');
        fetchAnnouncements();
      }
    } catch (err) {
      toast.error('Failed to publish announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminApi.deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success('Announcement deleted.');
    } catch (err) {
      toast.error('Could not delete announcement.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              MEGAPHONE BROADCASTS
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Broadcast platform updates, exam dates, syllabus revisions, and urgent notices to all approved students.
          </p>
        </div>

        <ComicButton
          variant="yellow"
          size="sm"
          onClick={() => setShowModal(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          NEW BROADCAST
        </ComicButton>
      </div>

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon="📢"
          title="NO BROADCASTS YET"
          description="Create your first announcement to notify all batch students on their dashboard."
          actionLabel="CREATE FIRST ANNOUNCEMENT"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="comic-box p-5 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-xl uppercase tracking-wide text-ink">
                    {a.title}
                  </h3>
                  <span
                    className={`font-comic text-[10px] px-1.5 py-0.2 rounded border border-ink ${
                      a.priority === 'urgent'
                        ? 'bg-punch-red text-cream'
                        : a.priority === 'high'
                        ? 'bg-comic-yellow text-ink'
                        : 'bg-cream text-ink'
                    }`}
                  >
                    {a.priority.toUpperCase()}
                  </span>
                </div>

                <p className="font-sans text-xs text-olive-dark font-medium leading-relaxed max-w-2xl">
                  {a.content}
                </p>

                <div className="font-mono text-[10px] text-ink/60 pt-1">
                  Posted: {new Date(a.created_at).toLocaleDateString()} • By {a.author_name || 'Admin'}
                </div>
              </div>

              <button
                onClick={() => handleDelete(a.id)}
                className="comic-btn comic-btn-red text-xs px-2.5 py-1 flex-shrink-0"
              >
                DELETE
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Announcement Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="comic-box-lg max-w-lg w-full bg-cream p-6 animate-in fade-in">
            <h3 className="font-heading text-2xl uppercase tracking-wide text-ink mb-4">
              BROADCAST BATCH ANNOUNCEMENT
            </h3>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <ComicInput
                label="Announcement Title"
                placeholder="e.g. End-Sem Exam Schedule Announced"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <ComicInput
                label="Message Content"
                textarea={true}
                rows={4}
                placeholder="Please find the official timetable uploaded in the Question Bank vault..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />

              <div>
                <label className="font-comic text-xs uppercase text-ink block mb-1">
                  PRIORITY LEVEL
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="comic-input text-xs py-2 bg-white"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="comic-btn comic-btn-white text-xs"
                >
                  CANCEL
                </button>
                <ComicButton type="submit" variant="yellow" size="sm" loading={saving}>
                  BROADCAST NOW
                </ComicButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAnnouncements;

