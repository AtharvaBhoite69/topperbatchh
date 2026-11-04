import React, { useState, useEffect } from 'react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { EmptyState, LoadingSkeleton } from '../../components/ui/ComicElements';
import api from '../../services/api';
import { ShieldAlert, CheckCircle, Trash2, Plus, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

export const CommunityModeration = () => {
  const [reports, setReports] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Channel Form
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');

  useEffect(() => {
    fetchReportsAndChannels();
  }, []);

  const fetchReportsAndChannels = async () => {
    setLoading(true);
    try {
      const [repRes, chanRes] = await Promise.all([
        api.get('/community/reports'),
        api.get('/community/channels'),
      ]);

      if (repRes.data?.success) setReports(repRes.data.reports || []);
      if (chanRes.data?.success) setChannels(chanRes.data.channels || []);
    } catch (err) {
      toast.error('Failed to load community reports.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveReport = async (id, status) => {
    try {
      await api.put(`/community/reports/${id}`, { status });
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      toast.success(`Report marked as ${status}.`);
    } catch (err) {
      toast.error('Failed to resolve report.');
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    try {
      await api.post('/community/channels', {
        name: channelName.trim(),
        description: channelDesc.trim(),
      });
      toast.success('Channel created!');
      setChannelName('');
      setChannelDesc('');
      setShowChannelModal(false);
      fetchReportsAndChannels();
    } catch (err) {
      toast.error('Could not create channel.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              COMMUNITY PATROL & MODERATION
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Review reported messages from students, enforce batch conduct, and create new channels.
          </p>
        </div>

        <button
          onClick={() => setShowChannelModal(true)}
          className="comic-btn comic-btn-yellow text-xs"
        >
          + CREATE CHANNEL
        </button>
      </div>

      {/* Reported Messages */}
      <div className="comic-box bg-white p-6">
        <h3 className="font-heading text-xl uppercase tracking-wide text-ink mb-4 border-b-2 border-ink/20 pb-2">
          FLAGGED STUDENT MESSAGES ({reports.filter((r) => r.status === 'pending').length} PENDING)
        </h3>

        {loading ? (
          <LoadingSkeleton count={3} />
        ) : reports.length === 0 ? (
          <p className="text-xs text-olive-dark font-sans py-4 text-center">
            🕊️ Clean waters! No reported messages currently flagged.
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="comic-box-sm p-4 bg-cream flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-comic text-[10px] bg-punch-red text-cream px-1.5 py-0.2 rounded border border-ink">
                      REASON: {r.reason}
                    </span>
                    <span className="font-mono text-[10px] text-ink/70">
                      Reported by {r.reporter_name}
                    </span>
                  </div>

                  <p className="font-sans text-xs text-ink font-semibold italic bg-white p-2 rounded border border-ink/20">
                    "{r.message_content || 'Message was deleted.'}"
                  </p>
                </div>

                {r.status === 'pending' ? (
                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleResolveReport(r.id, 'resolved')}
                      className="comic-btn comic-btn-green text-xs px-2.5 py-1"
                    >
                      RESOLVE
                    </button>
                    <button
                      onClick={() => handleResolveReport(r.id, 'dismissed')}
                      className="comic-btn comic-btn-white text-xs px-2.5 py-1"
                    >
                      DISMISS
                    </button>
                  </div>
                ) : (
                  <span className="font-comic text-xs uppercase text-victory-green font-bold">
                    {r.status.toUpperCase()} ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Channel Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="comic-box-lg max-w-md w-full bg-cream p-6 animate-in fade-in">
            <h3 className="font-heading text-2xl uppercase tracking-wide text-ink mb-4">
              CREATE COMMUNITY CHANNEL
            </h3>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="font-comic text-xs uppercase text-ink block mb-1">
                  CHANNEL NAME
                </label>
                <div className="flex items-center">
                  <span className="p-2 bg-white border-2 border-r-0 border-ink font-bold text-ink">#</span>
                  <input
                    type="text"
                    placeholder="e.g. artificial-intelligence"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="comic-input text-xs py-2 bg-white rounded-l-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-comic text-xs uppercase text-ink block mb-1">
                  CHANNEL TOPIC / DESCRIPTION
                </label>
                <textarea
                  rows={2}
                  placeholder="Discussions around AI algorithms, lab assignments & projects..."
                  value={channelDesc}
                  onChange={(e) => setChannelDesc(e.target.value)}
                  className="comic-input text-xs py-2 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChannelModal(false)}
                  className="comic-btn comic-btn-white text-xs"
                >
                  CANCEL
                </button>
                <ComicButton type="submit" variant="yellow" size="sm">
                  CREATE CHANNEL
                </ComicButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityModeration;

