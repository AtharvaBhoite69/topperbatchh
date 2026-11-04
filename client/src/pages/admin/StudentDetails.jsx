import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { LoadingSkeleton } from '../../components/ui/ComicElements';
import { admin as adminApi } from '../../services/api';
import { ArrowLeft, Shield, Clock, Zap, Ban, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export const StudentDetails = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const res = await adminApi.getStudent(id);
        if (res.data?.success) {
          setData(res.data);
        }
      } catch (err) {
        toast.error('Could not load student profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [id]);

  const handleRevokeSessions = async () => {
    try {
      await adminApi.revokeUserSessions(id);
      toast.success('All active sessions revoked for this student.');
    } catch (err) {
      toast.error('Could not revoke sessions.');
    }
  };

  if (loading) return <LoadingSkeleton count={3} />;
  if (!data?.student) return null;

  const { student, attempts = [], sessions = [], auditLogs = [] } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none">
      <Link to="/admin/students">
        <ComicButton variant="white" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
          BACK TO ROSTER
        </ComicButton>
      </Link>

      {/* Header Info */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              {student.full_name}
            </h1>
            <span className="font-comic text-xs bg-comic-yellow text-ink px-2 py-0.5 rounded border border-ink">
              {student.status.toUpperCase()}
            </span>
          </div>
          <div className="font-mono text-xs text-olive-dark mt-1">
            {student.email} • Sem {student.semester || 1} • {student.department || 'CS'} • {student.total_points || 0} pts
          </div>
        </div>

        <ComicButton
          variant="red"
          size="sm"
          onClick={handleRevokeSessions}
          icon={<LogOut className="w-3.5 h-3.5" />}
        >
          REVOKE ALL SESSIONS
        </ComicButton>
      </div>

      {/* Recent Attempts */}
      <div className="comic-box bg-white p-5">
        <h3 className="font-heading text-lg uppercase text-ink mb-3 border-b-2 border-ink/20 pb-2">
          RECENT CHALLENGE ATTEMPTS ({attempts.length})
        </h3>
        {attempts.length === 0 ? (
          <p className="text-xs text-olive-dark font-sans">No challenge attempts on record.</p>
        ) : (
          <div className="space-y-2">
            {attempts.map((a) => (
              <div key={a.id} className="comic-box-sm p-3 bg-cream flex justify-between items-center text-xs">
                <div>
                  <strong className="font-heading uppercase">{a.challenge_title || 'Daily Battle'}</strong>
                  <div className="font-mono text-[10px] text-ink/70">
                    Correct: {a.total_correct} • Time: {a.time_taken_seconds}s
                  </div>
                </div>
                <span className="font-heading text-base text-ink">{a.score} PTS</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Device Sessions */}
      <div className="comic-box bg-white p-5">
        <h3 className="font-heading text-lg uppercase text-ink mb-3 border-b-2 border-ink/20 pb-2">
          DEVICE SESSIONS ({sessions.length})
        </h3>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="p-2.5 border border-ink/30 rounded text-xs font-mono flex justify-between items-center">
              <div>
                <div>{s.device_info || 'Browser Session'}</div>
                <div className="text-[10px] text-ink/60">IP: {s.ip_address} • Active: {s.is_active ? 'YES' : 'NO'}</div>
              </div>
              <span className={`text-[10px] font-bold ${s.is_active ? 'text-victory-green' : 'text-punch-red'}`}>
                {s.is_active ? 'ONLINE' : 'REVOKED'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentDetails;

