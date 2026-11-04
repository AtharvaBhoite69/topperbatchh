import React, { useState, useEffect } from 'react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { LoadingSkeleton, EmptyState } from '../../components/ui/ComicElements';
import { admin as adminApi } from '../../services/api';
import { Shield, Smartphone, Globe, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export const SessionManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getActiveSessions();
      if (res.data?.success) {
        setSessions(res.data.sessions || []);
      }
    } catch (err) {
      toast.error('Failed to load active sessions.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      await adminApi.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Session terminated.');
    } catch (err) {
      toast.error('Could not revoke session.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left select-none">
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              ACTIVE SESSIONS & DEVICES
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Monitor real-time authorized device tokens. Force logout suspicious devices or reset student logins.
          </p>
        </div>

        <span className="font-comic text-xs bg-victory-green text-cream px-3 py-1 rounded border border-ink shadow-[2px_2px_0px_#171510] uppercase">
          {sessions.length} ACTIVE SESSIONS
        </span>
      </div>

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : sessions.length === 0 ? (
        <EmptyState icon="🔒" title="NO ACTIVE SESSIONS" description="No logged in users right now." />
      ) : (
        <div className="comic-box bg-white overflow-hidden">
          <div className="divide-y-2 divide-ink/10">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-heading text-sm uppercase text-ink">
                      {s.full_name} ({s.email})
                    </span>
                    <span className="font-comic text-[9px] bg-comic-yellow text-ink px-1.5 py-0.2 rounded border border-ink">
                      {s.role.toUpperCase()}
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-olive-dark">
                    Device: {s.device_info || 'Unknown'} • IP: {s.ip_address} • Logged In: {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>

                <ComicButton
                  variant="red"
                  size="sm"
                  onClick={() => handleRevoke(s.id)}
                  icon={<LogOut className="w-3.5 h-3.5" />}
                >
                  REVOKE
                </ComicButton>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionManagement;

