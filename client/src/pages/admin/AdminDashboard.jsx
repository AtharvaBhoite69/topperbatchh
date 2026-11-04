import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { ComicBadge, LoadingSkeleton } from '../../components/ui/ComicElements';
import { admin as adminApi } from '../../services/api';
import {
  Shield,
  UserCheck,
  UserX,
  Clock,
  BookOpen,
  Zap,
  Users,
  Megaphone,
  ArrowRight,
  Settings,
  Upload,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [pendingRecruits, setPendingRecruits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [statsRes, regRes] = await Promise.all([
          adminApi.getStats(),
          adminApi.getRegistrations(),
        ]);

        if (statsRes.data?.success) {
          setStats(statsRes.data.stats);
        }
        if (regRes.data?.success) {
          setPendingRecruits(regRes.data.registrations || []);
        }
      } catch (err) {
        toast.error('Failed to load admin stats.');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  const s = stats || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-left select-none">
      {/* Admin HQ Header */}
      <div className="comic-box bg-white p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-7 h-7 text-punch-red" />
            <h1 className="font-heading text-3xl sm:text-4xl uppercase tracking-wide text-ink">
              ADMIN COMMAND HQ
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Live database telemetry, student registration gateway, question bank uploads, and competition scheduling.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/mcq-generator">
            <ComicButton variant="yellow" size="sm" icon={<Sparkles className="w-4 h-4 text-punch-red" />}>
              AI MCQ FORGE
            </ComicButton>
          </Link>
          <Link to="/admin/upload">
            <ComicButton variant="white" size="sm" icon={<Upload className="w-4 h-4" />}>
              UPLOAD PDF
            </ComicButton>
          </Link>
          <Link to="/admin/challenges">
            <ComicButton variant="red" size="sm" icon={<Zap className="w-4 h-4" />}>
              SCHEDULE BATTLE
            </ComicButton>
          </Link>
        </div>
      </div>

      {/* Real Database Telemetry Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ComicCard accent="yellow" className="bg-white p-4">
          <div className="flex justify-between items-center text-xs font-comic text-ink/70 uppercase">
            <span>TOTAL STUDENTS</span>
            <Users className="w-4 h-4 text-ink" />
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {s.totalStudents || 0}
          </div>
          <span className="text-[10px] font-mono text-olive-dark block mt-1">
            {s.approvedStudents || 0} Approved Active
          </span>
        </ComicCard>

        <ComicCard accent="red" className="bg-white p-4">
          <div className="flex justify-between items-center text-xs font-comic text-punch-red uppercase font-bold">
            <span>PENDING APPROVALS</span>
            <Clock className="w-4 h-4 text-punch-red" />
          </div>
          <div className="font-heading text-3xl text-punch-red mt-1">
            {s.pendingStudents || 0}
          </div>
          <Link to="/admin/registrations" className="text-[10px] font-mono text-punch-red underline block mt-1 font-bold">
            Review requests →
          </Link>
        </ComicCard>

        <ComicCard accent="olive" className="bg-white p-4">
          <div className="flex justify-between items-center text-xs font-comic text-ink/70 uppercase">
            <span>VAULT DOCUMENTS</span>
            <BookOpen className="w-4 h-4 text-ink" />
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {s.totalDocuments || 0}
          </div>
          <span className="text-[10px] font-mono text-olive-dark block mt-1">
            Indexed for Gemini RAG
          </span>
        </ComicCard>

        <ComicCard accent="green" className="bg-white p-4">
          <div className="flex justify-between items-center text-xs font-comic text-victory-green uppercase font-bold">
            <span>QUIZ ATTEMPTS</span>
            <Zap className="w-4 h-4 text-victory-green" />
          </div>
          <div className="font-heading text-3xl text-ink mt-1">
            {s.totalQuizAttempts || 0}
          </div>
          <span className="text-[10px] font-mono text-olive-dark block mt-1">
            {s.activeToday || 0} Active Today
          </span>
        </ComicCard>
      </div>

      {/* Quick Action Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/admin/registrations" className="block">
          <div className="comic-box p-4 bg-cream hover:bg-white transition-colors flex items-center justify-between">
            <div>
              <h4 className="font-heading text-base uppercase text-ink">PENDING RECRUITS</h4>
              <span className="text-xs font-sans text-olive-dark">Approve / decline requests</span>
            </div>
            <ArrowRight className="w-4 h-4 text-punch-red" />
          </div>
        </Link>

        <Link to="/admin/documents" className="block">
          <div className="comic-box p-4 bg-cream hover:bg-white transition-colors flex items-center justify-between">
            <div>
              <h4 className="font-heading text-base uppercase text-ink">DOCUMENT VAULT</h4>
              <span className="text-xs font-sans text-olive-dark">Manage & upload PDFs</span>
            </div>
            <ArrowRight className="w-4 h-4 text-punch-red" />
          </div>
        </Link>

        <Link to="/admin/questions" className="block">
          <div className="comic-box p-4 bg-cream hover:bg-white transition-colors flex items-center justify-between">
            <div>
              <h4 className="font-heading text-base uppercase text-ink">MCQ FORGE</h4>
              <span className="text-xs font-sans text-olive-dark">Create & manage questions</span>
            </div>
            <ArrowRight className="w-4 h-4 text-punch-red" />
          </div>
        </Link>

        <Link to="/admin/announcements" className="block">
          <div className="comic-box p-4 bg-cream hover:bg-white transition-colors flex items-center justify-between">
            <div>
              <h4 className="font-heading text-base uppercase text-ink">MEGAPHONE</h4>
              <span className="text-xs font-sans text-olive-dark">Broadcast to whole batch</span>
            </div>
            <ArrowRight className="w-4 h-4 text-punch-red" />
          </div>
        </Link>
      </div>

      {/* Pending Registrations Preview */}
      <div className="comic-box bg-white p-6">
        <div className="flex items-center justify-between mb-4 border-b-2 border-ink/20 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-punch-red" />
            <h3 className="font-heading text-xl uppercase tracking-wide text-ink">
              PENDING REGISTRATION REQUESTS ({pendingRecruits.length})
            </h3>
          </div>
          <Link
            to="/admin/registrations"
            className="font-comic text-xs uppercase text-punch-red hover:underline"
          >
            VIEW ALL RECRUITS →
          </Link>
        </div>

        {pendingRecruits.length === 0 ? (
          <p className="text-xs text-olive-dark font-sans py-4 text-center">
            🎉 All caught up! No pending registrations awaiting approval.
          </p>
        ) : (
          <div className="divide-y-2 divide-ink/10">
            {pendingRecruits.slice(0, 5).map((r) => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <h5 className="font-heading text-sm uppercase text-ink">
                    {r.full_name}
                  </h5>
                  <div className="font-mono text-xs text-olive-dark">
                    {r.email} • Sem {r.semester || 1} ({r.department || 'CS'})
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link to="/admin/registrations">
                    <ComicButton variant="yellow" size="sm">
                      REVIEW
                    </ComicButton>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

