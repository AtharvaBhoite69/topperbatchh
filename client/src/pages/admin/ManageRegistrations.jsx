import React, { useState, useEffect } from 'react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { EmptyState, LoadingSkeleton } from '../../components/ui/ComicElements';
import { admin as adminApi } from '../../services/api';
import { UserCheck, Check, X, Shield, Mail, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export const ManageRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getRegistrations();
      if (res.data?.success) {
        setRegistrations(res.data.registrations || []);
      }
    } catch (err) {
      toast.error('Failed to load pending registrations.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    setProcessingId(id);
    try {
      if (action === 'approve') {
        await adminApi.approveRegistration(id);
        toast.success('Student approved! Notification dispatched.');
      } else {
        const reason = window.prompt('Reason for rejecting registration (optional):');
        await adminApi.rejectRegistration(id, { reason });
        toast.success('Registration declined.');
      }

      setRegistrations((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action} user.`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              PENDING RECRUITS VERIFICATION
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Review student registrations before granting access to TopperBatch materials and competition arenas.
          </p>
        </div>

        <span className="font-comic text-xs bg-comic-yellow text-ink px-2.5 py-1 rounded border border-ink shadow-[2px_2px_0px_#171510] uppercase">
          {registrations.length} REQUESTS AWAITING
        </span>
      </div>

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : registrations.length === 0 ? (
        <EmptyState
          icon="🎉"
          title="NO PENDING RECRUITS!"
          description="Every student registration request has been reviewed. You are completely caught up!"
        />
      ) : (
        <div className="space-y-3">
          {registrations.map((r) => {
            const isProcessing = processingId === r.id;
            return (
              <div
                key={r.id}
                className="comic-box p-5 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-xl uppercase tracking-wide text-ink">
                      {r.full_name}
                    </h3>
                    <span className="font-comic text-[10px] bg-comic-yellow text-ink px-1.5 py-0.2 rounded border border-ink">
                      Sem {r.semester || 1}
                    </span>
                  </div>

                  <div className="font-mono text-xs text-olive-dark flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {r.email}
                    </span>
                    <span>•</span>
                    <span>{r.department || 'Computer Science'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-ink/60">
                      <Calendar className="w-3.5 h-3.5" /> Registered: {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Approve & Reject Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                  <ComicButton
                    variant="green"
                    size="sm"
                    loading={isProcessing}
                    onClick={() => handleAction(r.id, 'approve')}
                    icon={<Check className="w-4 h-4" />}
                  >
                    APPROVE
                  </ComicButton>

                  <ComicButton
                    variant="red"
                    size="sm"
                    loading={isProcessing}
                    onClick={() => handleAction(r.id, 'reject')}
                    icon={<X className="w-4 h-4" />}
                  >
                    DECLINE
                  </ComicButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ManageRegistrations;

