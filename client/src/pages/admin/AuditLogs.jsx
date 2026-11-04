import React, { useState, useEffect } from 'react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { LoadingSkeleton, EmptyState } from '../../components/ui/ComicElements';
import { admin as adminApi } from '../../services/api';
import { Shield, Clock, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs({ page, limit: 30 });
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        setTotalPages(res.data.pagination?.pages || 1);
      }
    } catch (err) {
      toast.error('Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              IMMUTABLE AUDIT TRAIL
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Complete security log of all administrative actions, user approvals, status changes, and settings modifications.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : logs.length === 0 ? (
        <EmptyState icon="📜" title="NO AUDIT ENTRIES" description="Administrative events will be logged here." />
      ) : (
        <div className="comic-box bg-white overflow-hidden">
          <div className="divide-y-2 divide-ink/10">
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-comic text-[10px] bg-comic-yellow text-ink px-1.5 py-0.2 rounded border border-ink font-bold">
                      {log.action}
                    </span>
                    <span className="font-heading text-sm uppercase text-ink">
                      By {log.admin_name || log.admin_email || 'System'}
                    </span>
                  </div>

                  {log.details && (
                    <div className="font-mono text-[11px] text-olive-dark break-all">
                      Details: {log.details}
                    </div>
                  )}
                </div>

                <div className="text-right text-[10px] font-mono text-ink/60 flex-shrink-0">
                  <div>{new Date(log.created_at).toLocaleString()}</div>
                  <div>IP: {log.ip_address || '127.0.0.1'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <ComicButton
            variant="white"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            PREV
          </ComicButton>
          <span className="font-heading text-xs text-ink px-3">
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

export default AuditLogs;

