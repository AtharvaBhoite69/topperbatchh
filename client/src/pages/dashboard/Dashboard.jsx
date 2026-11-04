import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ComicCard from '../../components/ui/ComicCard';
import ComicButton from '../../components/ui/ComicButton';
import { Starburst, ComicBadge } from '../../components/ui/ComicElements';
import {
  BookOpen,
  MessageCircle,
  Bot,
  FileText,
  Zap,
  FileQuestion,
  Users,
  Trophy,
  Calendar,
  User,
  Flame,
  ArrowRight,
  Megaphone,
  Clock,
  Sparkles,
} from 'lucide-react';
import { quiz as quizApi, documents as docApi, admin as adminApi } from '../../services/api';

export const Dashboard = () => {
  const { user } = useAuth();
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [docCount, setDocCount] = useState(0);
  const [quizStats, setQuizStats] = useState({ totalAttempts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [dailyRes, docsRes, annRes] = await Promise.allSettled([
          quizApi.getDaily(),
          docApi.list({ limit: 1 }),
          adminApi.getAnnouncements(),
        ]);

        if (dailyRes.status === 'fulfilled' && dailyRes.value.data?.success) {
          setDailyChallenge(dailyRes.value.data);
        }

        if (docsRes.status === 'fulfilled' && docsRes.value.data?.pagination) {
          setDocCount(docsRes.value.data.pagination.total || 0);
        }

        if (annRes.status === 'fulfilled' && annRes.value.data?.announcements) {
          setAnnouncements(annRes.value.data.announcements.slice(0, 3));
        }
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const quickAccessCards = [
    {
      title: 'QUESTION BANK',
      desc: 'Previous year papers & unit question banks',
      icon: BookOpen,
      to: '/question-bank',
      accent: 'yellow',
      badge: 'HIGH YIELD',
    },
    {
      title: 'COMMUNITY CHAT',
      desc: 'Connect with batchmates in real-time channels',
      icon: MessageCircle,
      to: '/community',
      accent: 'olive',
    },
    {
      title: 'AI STUDY BUDDY',
      desc: 'Ask questions about PDFs with page citations',
      icon: Bot,
      to: '/ai-chat',
      accent: 'red',
      badge: 'GEMINI RAG',
    },
    {
      title: 'NOTES & PDFS',
      desc: 'Protected reading view with inline notes',
      icon: FileText,
      to: '/question-bank',
      accent: 'yellow',
    },
    {
      title: 'DAILY MCQ CHALLENGE',
      desc: '10 questions daily battle for leaderboard points',
      icon: Zap,
      to: '/daily-challenge',
      accent: 'red',
      badge: 'TODAY',
    },
    {
      title: 'MOCK TESTS',
      desc: 'Full-length practice exams with timer',
      icon: FileQuestion,
      to: '/mock-tests',
      accent: 'olive',
    },
    {
      title: 'STUDY GROUPS',
      desc: 'Group review rooms and collaborative prep',
      icon: Users,
      to: '/study-groups',
      accent: 'green',
    },
    {
      title: 'LEADERBOARD',
      desc: 'Daily, weekly and all-time batch rankings',
      icon: Trophy,
      to: '/leaderboard',
      accent: 'yellow',
      badge: 'TOP 3',
    },
    {
      title: 'AIML EXAM CALENDAR',
      desc: 'Official MU Winter 2026 Sem V Timetable (5 Papers)',
      icon: Calendar,
      to: '/exam-planner',
      accent: 'red',
      badge: 'NOV 2026',
    },
    {
      title: 'MY PROFILE',
      desc: 'Achievements, study streak & activity stats',
      icon: User,
      to: '/profile',
      accent: 'green',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="comic-box-lg bg-cream p-6 sm:p-8 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="z-10 max-w-xl text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-comic text-xs uppercase bg-punch-red text-cream px-2.5 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510]">
              🔥 SEMESTER 2026 ACTIVE
            </span>
            <span className="font-comic text-xs uppercase bg-comic-yellow text-ink px-2 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510]">
              ISS SEM, 9 POINTER FIX!
            </span>
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl uppercase tracking-tight text-ink leading-tight">
            WHAT'S UP, {user?.full_name?.split(' ')[0] || 'TOPPER'}! 💥
          </h1>

          <p className="font-sans text-xs sm:text-sm text-vintage-olive mt-2 font-medium">
            Welcome to the command post. Review uploaded question banks, test your speed in the daily MCQ arena, and ask AI to summarize complex unit topics.
          </p>
        </div>

        {/* Right Gamification Widget (matching screenshot's starburst & counter style) */}
        <div className="flex items-center gap-4 z-10 flex-shrink-0">
          <div className="comic-box bg-white p-3 text-center min-w-[90px]">
            <div className="flex items-center justify-center gap-1 text-punch-red font-comic text-xs uppercase font-bold">
              <Flame className="w-4 h-4 fill-current" /> STREAK
            </div>
            <div className="font-heading text-3xl text-ink mt-0.5">
              {user?.study_streak || 0}
            </div>
            <span className="text-[10px] font-mono text-ink/70">DAYS ACTIVE</span>
          </div>

          <div className="comic-box bg-comic-yellow p-3 text-center min-w-[100px]">
            <div className="flex items-center justify-center gap-1 text-ink font-comic text-xs uppercase font-bold">
              <Trophy className="w-4 h-4" /> POINTS
            </div>
            <div className="font-heading text-3xl text-ink mt-0.5">
              {user?.total_points || 0}
            </div>
            <span className="text-[10px] font-mono text-ink/70">TOTAL SCORE</span>
          </div>
        </div>
      </div>

      {/* Daily Challenge Callout Card */}
      {dailyChallenge?.challenge && (
        <div className="comic-box bg-white p-5 border-l-[8px] border-l-punch-red flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-lg bg-punch-red text-cream flex items-center justify-center border-2 border-ink shadow-[3px_3px_0px_#171510] flex-shrink-0">
              <Zap className="w-7 h-7 fill-current" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-comic text-xs text-punch-red font-bold uppercase tracking-wider">
                  TODAY'S MCQ BATTLE
                </span>
                <span className="font-mono text-[11px] bg-cream px-1.5 py-0.5 border border-ink rounded">
                  {dailyChallenge.challenge.duration_minutes} MINS
                </span>
              </div>
              <h3 className="font-heading text-xl uppercase tracking-wide text-ink mt-0.5">
                {dailyChallenge.challenge.title}
              </h3>
              <p className="font-sans text-xs text-olive-dark font-medium">
                {dailyChallenge.challenge.description ||
                  `Subject: ${dailyChallenge.challenge.subject_name || 'General Batch Topics'} • 10 Questions`}
              </p>
            </div>
          </div>

          {dailyChallenge.userAttempt?.is_submitted ? (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto flex-shrink-0">
              <div className="comic-badge comic-badge-green">
                SCORE: {dailyChallenge.userAttempt.score} PTS ✓
              </div>
              <Link to={`/quiz/${dailyChallenge.challenge.id}/results`} className="w-full sm:w-auto">
                <ComicButton variant="olive" size="sm" className="w-full sm:w-auto">
                  REVIEW ANSWERS
                </ComicButton>
              </Link>
            </div>
          ) : (
            <Link to="/daily-challenge" className="w-full sm:w-auto flex-shrink-0">
              <ComicButton variant="red" size="md" className="w-full sm:w-auto" icon={<Zap className="w-4 h-4 fill-current" />}>
                START THE BATTLE!
              </ComicButton>
            </Link>
          )}
        </div>
      )}

      {/* 10 Quick-Access Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-heading text-2xl uppercase tracking-wide text-ink">
              MISSION ARSENAL
            </span>
            <ComicBadge variant="yellow">10 WEAPONS</ComicBadge>
          </div>
          <span className="font-comic text-xs text-olive-dark uppercase">
            CLICK CARD TO LAUNCH
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {quickAccessCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link key={idx} to={card.to} className="no-underline group">
                <ComicCard
                  accent={card.accent}
                  interactive={true}
                  className="h-full p-4 bg-white flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-md bg-cream border-2 border-ink flex items-center justify-center shadow-[2px_2px_0px_#171510] group-hover:bg-comic-yellow transition-colors">
                        <Icon className="w-5 h-5 text-ink" />
                      </div>
                      {card.badge && (
                        <span className="font-comic text-[10px] bg-punch-red text-cream px-1.5 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510]">
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading text-lg uppercase tracking-wide text-ink group-hover:text-punch-red transition-colors">
                      {card.title}
                    </h3>
                    <p className="font-sans text-[11px] text-olive-dark mt-1 line-clamp-2 font-medium">
                      {card.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-ink/15 flex items-center justify-between text-[11px] font-comic uppercase text-ink group-hover:translate-x-1 transition-transform">
                    <span>OPEN PORTAL</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </ComicCard>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Announcements & Batch Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Announcements List */}
        <div className="lg:col-span-2 comic-box bg-white p-6 text-left">
          <div className="flex items-center justify-between mb-4 border-b-2 border-ink/20 pb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-punch-red" />
              <h2 className="font-heading text-xl uppercase tracking-wide text-ink">
                BATCH BROADCASTS & ANNOUNCEMENTS
              </h2>
            </div>
            <span className="font-mono text-xs text-ink/70">OFFICIAL UPDATES</span>
          </div>

          {announcements.length === 0 ? (
            <p className="text-xs text-olive-dark font-sans py-4">
              No new announcements today. Check back before exam week!
            </p>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="comic-box-sm p-3.5 bg-cream hover:bg-cream/70 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-heading text-sm uppercase text-ink">
                      {ann.title}
                    </span>
                    <span className="font-comic text-[10px] bg-punch-red text-cream px-1.5 py-0.5 rounded border border-ink">
                      {ann.priority}
                    </span>
                  </div>
                  <p className="font-sans text-xs text-olive-dark font-medium leading-relaxed">
                    {ann.content}
                  </p>
                  <div className="mt-2 text-[10px] font-mono text-ink/60">
                    Broadcasted: {new Date(ann.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Study Tracker */}
        <div className="comic-box bg-white p-6 text-left flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 border-b-2 border-ink/20 pb-3">
              <Sparkles className="w-5 h-5 text-comic-yellow fill-comic-yellow" />
              <h2 className="font-heading text-xl uppercase tracking-wide text-ink">
                SEMESTER STATS
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-1.5 border-b border-ink/10 text-xs font-mono">
                <span className="text-ink/80">Available Materials</span>
                <span className="font-heading text-sm text-ink">{docCount} PDFs</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-ink/10 text-xs font-mono">
                <span className="text-ink/80">Registered Semester</span>
                <span className="font-heading text-sm text-ink">Sem {user?.semester || 3}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-ink/10 text-xs font-mono">
                <span className="text-ink/80">Department</span>
                <span className="font-heading text-sm text-ink">{user?.department || 'CS'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 text-xs font-mono">
                <span className="text-ink/80">Current Goal</span>
                <span className="font-heading text-sm text-punch-red font-bold">9.0+ SGPA</span>
              </div>
            </div>
          </div>

          <Link to="/question-bank" className="mt-6">
            <ComicButton variant="yellow" size="sm" className="w-full">
              BROWSE ALL MATERIALS
            </ComicButton>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

