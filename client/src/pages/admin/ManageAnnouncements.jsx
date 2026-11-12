import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import ComicInput from '../../components/ui/ComicInput';
import { EmptyState, LoadingSkeleton } from '../../components/ui/ComicElements';
import { admin as adminApi } from '../../services/api';
import { Megaphone, Plus, Trash2, Mail, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export const ManageAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state (Announcement modal)
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('normal');
  const [sendEmailWithAnnouncement, setSendEmailWithAnnouncement] = useState(false);
  const [saving, setSaving] = useState(false);

  // Standalone Email Broadcast modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailAudience, setEmailAudience] = useState('approved');
  const [studentsList, setStudentsList] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState('');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (showEmailModal && emailAudience === 'single' && studentsList.length === 0) {
      adminApi
        .getStudents({ limit: 500, status: 'all' })
        .then((res) => {
          if (res.data?.success) {
            setStudentsList(res.data.students || []);
          }
        })
        .catch(() => {
          toast.error('Failed to load student list.');
        });
    }
  }, [showEmailModal, emailAudience, studentsList.length]);

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
        sendEmail: sendEmailWithAnnouncement,
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Announcement broadcasted to entire batch!');
        setShowModal(false);
        setTitle('');
        setContent('');
        setSendEmailWithAnnouncement(false);
        fetchAnnouncements();
      }
    } catch (err) {
      toast.error('Failed to publish announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmailBroadcast = async (e) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailMessage.trim()) return;
    if (emailAudience === 'single' && !selectedStudentId) {
      toast.error('Please select a student to send personal email.');
      return;
    }

    setSendingEmail(true);
    setEmailProgress('Starting...');

    try {
      let offset = 0;
      let totalSent = 0;
      let totalAudience = 0;
      let hasMore = true;
      let serverMessage = '';

      while (hasMore) {
        const res = await adminApi.sendEmailBroadcast({
          subject: emailSubject.trim(),
          title: emailSubject.trim(),
          message: emailMessage.trim(),
          audience: emailAudience,
          recipientId: emailAudience === 'single' ? selectedStudentId : undefined,
          offset,
          limit: 10,
        });

        const result = res.data?.result;
        if (!res.data?.success || !result) {
          throw new Error(res.data?.error || 'Could not send email update.');
        }

        serverMessage = res.data?.message || serverMessage;
        totalSent += result.sentCount || 0;
        totalAudience = result.totalAudience || totalSent;
        hasMore = Boolean(result.hasMore);
        offset = result.nextOffset || offset + 10;

        setEmailProgress(`Sent ${Math.min(offset, totalAudience)} / ${totalAudience}`);

        if (hasMore) {
          await new Promise((r) => setTimeout(r, 700));
        }
      }

      toast.success(
        emailAudience === 'single'
          ? serverMessage || 'Personal email sent!'
          : `Update emailed to ${totalSent} registered user(s)!`
      );
      setShowEmailModal(false);
      setEmailSubject('');
      setEmailMessage('');
      setSelectedStudentId('');
      setStudentSearch('');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not send email update.');
    } finally {
      setSendingEmail(false);
      setEmailProgress('');
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
            Broadcast platform updates, exam dates, syllabus revisions, and email updates directly to registered users&apos; email IDs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ComicButton
            variant="white"
            size="sm"
            onClick={() => setShowEmailModal(true)}
            icon={<Mail className="w-4 h-4 text-punch-red" />}
          >
            SEND EMAIL UPDATE
          </ComicButton>

          <ComicButton
            variant="yellow"
            size="sm"
            onClick={() => setShowModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            NEW BROADCAST
          </ComicButton>
        </div>
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

              <label className="flex items-center gap-2 p-2.5 bg-white border-2 border-ink rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmailWithAnnouncement}
                  onChange={(e) => setSendEmailWithAnnouncement(e.target.checked)}
                  className="w-4 h-4 accent-punch-red"
                />
                <span className="font-sans text-xs font-bold text-ink">
                  Also send this update via Email to all approved students&apos; registered email IDs
                </span>
              </label>

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

      {/* Standalone Email Update Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="comic-box-lg max-w-lg w-full bg-cream p-6 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-punch-red" />
              <h3 className="font-heading text-2xl uppercase tracking-wide text-ink">
                EMAIL REGISTERED USERS
              </h3>
            </div>
            <p className="font-sans text-xs text-olive-dark mb-4">
              Send direct email updates to registered students. Configure SMTP settings in{' '}
              <Link to="/admin/settings" className="underline font-bold text-punch-red">
                Control Room
              </Link>
              .
            </p>

            <form onSubmit={handleSendEmailBroadcast} className="space-y-4">
              <div>
                <label className="font-comic text-xs uppercase text-ink block mb-1">
                  TARGET AUDIENCE
                </label>
                <select
                  value={emailAudience}
                  onChange={(e) => setEmailAudience(e.target.value)}
                  className="comic-input text-xs py-2 bg-white"
                >
                  <option value="approved">Approved Students Only</option>
                  <option value="all">All Registered Users (Approved + Pending)</option>
                  <option value="pending">Pending Approval Users Only</option>
                  <option value="single">Specific Student (Personal Mail)</option>
                </select>
              </div>

              {emailAudience === 'single' && (
                <div className="space-y-2 p-3 bg-white border-2 border-ink rounded-lg">
                  <label className="font-comic text-xs uppercase text-ink block">
                    SELECT SPECIFIC STUDENT
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by student name or email..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="comic-input text-xs py-1.5 bg-cream"
                  />
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="comic-input text-xs py-2 bg-white"
                    required
                  >
                    <option value="">-- Choose a student --</option>
                    {studentsList
                      .filter((s) => {
                        const q = studentSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          (s.full_name || '').toLowerCase().includes(q) ||
                          (s.email || '').toLowerCase().includes(q)
                        );
                      })
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.email}) [{s.status}]
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <ComicInput
                label="Email Subject"
                placeholder="e.g. New Question Bank Uploaded for Sem 6"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                required
              />

              <ComicInput
                label="Email Update Message"
                textarea={true}
                rows={5}
                placeholder="Write the full update you want sent to students' registered Gmail/email IDs..."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                required
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="comic-btn comic-btn-white text-xs"
                >
                  CANCEL
                </button>
                <ComicButton
                  type="submit"
                  variant="yellow"
                  size="sm"
                  loading={sendingEmail}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  {emailProgress || 'SEND EMAIL UPDATE'}
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

