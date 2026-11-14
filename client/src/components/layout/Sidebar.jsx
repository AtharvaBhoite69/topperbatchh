import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Logo from '../shared/Logo';
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  Zap,
  FileQuestion,
  MessageCircle,
  Trophy,
  Users,
  Calendar,
  User,
  Bell,
  Shield,
  UserCog,
  Upload,
  ListChecks,
  Megaphone,
  Settings,
  LogOut,
  X,
  Sparkles,
  ArrowLeftRight,
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/question-bank', label: 'Question Bank', icon: BookOpen },
    { to: '/ai-chat', label: 'AI Study Buddy', icon: Bot, badge: 'AI' },
    { to: '/daily-challenge', label: 'Daily MCQ Battle', icon: Zap, badge: 'HOT' },
    { to: '/mock-tests', label: 'Mock Tests', icon: FileQuestion },
    { to: '/community', label: 'Community Chat', icon: MessageCircle },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/study-groups', label: 'Study Groups', icon: Users },
    { to: '/exam-planner', label: 'Exam Calendar', icon: Calendar, badge: 'EXAM' },
    { to: '/profile', label: 'My Profile', icon: User },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Admin HQ', icon: Shield },
    { to: '/admin/mcq-generator', label: 'AI MCQ Generator', icon: Sparkles, badge: 'NEW' },
    { to: '/admin/dept-requests', label: 'Dept Requests', icon: ArrowLeftRight, badge: 'REQ' },
    { to: '/admin/registrations', label: 'Pending Recruits', icon: UserCog, badge: 'REQ' },
    { to: '/admin/students', label: 'Manage Students', icon: Users },
    { to: '/admin/documents', label: 'Vault / Uploads', icon: Upload },
    { to: '/admin/questions', label: 'MCQ Forge', icon: ListChecks },
    { to: '/admin/challenges', label: 'Battle Planner', icon: Zap },
    { to: '/exam-planner', label: 'Exam Timetable', icon: Calendar, badge: 'EDIT' },
    { to: '/admin/announcements', label: 'Megaphone', icon: Megaphone },
    { to: '/admin/settings', label: 'Control Room', icon: Settings, badge: '🔒' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink/60 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-vintage-olive text-cream flex flex-col border-r-[4px] border-ink shadow-[6px_0px_0px_#171510] transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header / Logo */}
        <div className="p-4 border-b-[3px] border-ink flex items-center justify-between bg-vintage-olive/90">
          <Logo size="sm" showTagline={false} />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-cream bg-ink border-2 border-cream rounded shadow-[2px_2px_0px_#171510]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tagline Ribbon */}
        <div className="bg-punch-red py-1 px-3 text-center border-b-2 border-ink">
          <span className="font-comic text-[11px] text-cream font-bold tracking-widest uppercase">
            ISS SEM, 9 POINTER FIX! 🚀
          </span>
        </div>

        {/* Navigation Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Student Hub */}
          <div>
            <div className="px-3 py-1 font-comic text-xs uppercase tracking-wider text-comic-yellow font-bold">
              STUDENT HQ
            </div>
            <nav className="space-y-1 mt-1">
              {studentLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => onClose && onClose()}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-md font-heading uppercase text-sm tracking-wide border-2 transition-all ${
                        isActive
                          ? 'bg-comic-yellow text-ink border-ink shadow-[3px_3px_0px_#171510] translate-x-1 font-bold'
                          : 'text-cream/90 border-transparent hover:bg-vintage-olive/60 hover:text-cream hover:border-ink/50'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="font-comic text-[10px] bg-punch-red text-cream px-1.5 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510]">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Admin Command (Admins Only) */}
          {isAdmin && (
            <div className="pt-2 border-t-2 border-ink/40">
              <div className="px-3 py-1 font-comic text-xs uppercase tracking-wider text-punch-red font-bold flex items-center justify-between">
                <span>COMMAND CENTER</span>
                <span className="text-[10px] bg-punch-red text-cream px-1 rounded">ADMIN</span>
              </div>
              <nav className="space-y-1 mt-1">
                {adminLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => onClose && onClose()}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-md font-heading uppercase text-sm tracking-wide border-2 transition-all ${
                          isActive
                            ? 'bg-punch-red text-cream border-ink shadow-[3px_3px_0px_#171510] translate-x-1 font-bold'
                            : 'text-cream/80 border-transparent hover:bg-vintage-olive/60 hover:text-cream'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="font-comic text-[10px] bg-comic-yellow text-ink px-1.5 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510]">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t-[3px] border-ink bg-vintage-olive/95 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-comic-yellow text-ink border-2 border-ink font-heading font-black flex items-center justify-center text-xs shadow-[2px_2px_0px_#171510] flex-shrink-0">
              {user?.full_name ? user.full_name.slice(0, 2).toUpperCase() : 'TB'}
            </div>
            <div className="overflow-hidden text-left">
              <div className="font-heading text-xs uppercase text-cream truncate">
                {user?.full_name || 'Student'}
              </div>
              <div className="font-sans text-[10px] text-cream/70 truncate">
                {user?.role === 'admin' ? '🛡️ Permanent Admin' : `Sem ${user?.semester || 1}`}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 bg-punch-red text-cream border-2 border-ink rounded shadow-[2px_2px_0px_#171510] hover:bg-punch-red/80 transition-all flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

