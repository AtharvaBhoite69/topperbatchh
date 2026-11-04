import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notifications as notifApi } from '../../services/api';
import { Menu, Search, Bell, Flame, Trophy, Shield } from 'lucide-react';

export const TopNav = ({ onToggleSidebar }) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await notifApi.getUnreadCount();
        if (res.data?.success) {
          setUnreadCount(res.data.count || 0);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000); // 1 min poll
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-cream border-b-[3px] border-ink shadow-[0px_4px_0px_#171510] px-4 py-2.5 flex items-center justify-between">
      {/* Left: Mobile hamburger & breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 bg-comic-yellow text-ink border-2 border-ink rounded shadow-[2px_2px_0px_#171510] hover:bg-comic-yellow/90"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <span className="font-comic text-xs uppercase bg-ink text-comic-yellow px-2 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510]">
            ⚡ ACTIVE BATCH
          </span>
          <span className="font-heading text-sm uppercase tracking-wide text-ink">
            TOPPERBATCH // 9-POINTER MISSION
          </span>
        </div>
      </div>

      {/* Middle: Global Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex-1 max-w-md mx-3 relative hidden md:block"
      >
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink pointer-events-none" />
        <input
          type="text"
          placeholder="SEARCH NOTES, DISCUSSIONS, QUESTIONS..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="comic-input text-xs pl-9 pr-3 py-1.5 bg-white shadow-[2px_2px_0px_#171510]"
        />
      </form>

      {/* Right: Gamification Badges & Notifications */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Streak */}
        <div
          title="Daily Study Streak"
          className="flex items-center gap-1 bg-white border-2 border-ink px-2.5 py-1 rounded shadow-[2px_2px_0px_#171510]"
        >
          <Flame className="w-4 h-4 text-punch-red fill-punch-red" />
          <span className="font-heading text-xs text-ink font-bold">
            {user?.study_streak || 0}d
          </span>
        </div>

        {/* Points */}
        <div
          title="Total Score Points"
          className="flex items-center gap-1 bg-comic-yellow text-ink border-2 border-ink px-2.5 py-1 rounded shadow-[2px_2px_0px_#171510]"
        >
          <Trophy className="w-4 h-4 text-ink" />
          <span className="font-heading text-xs font-black">
            {user?.total_points || 0} pts
          </span>
        </div>

        {/* Admin Badge */}
        {isAdmin && (
          <span className="hidden sm:inline-flex items-center gap-1 font-comic text-[11px] bg-punch-red text-cream px-2 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510] uppercase">
            <Shield className="w-3 h-3" /> ADMIN
          </span>
        )}

        {/* Notification Bell */}
        <Link
          to="/notifications"
          className="relative p-1.5 bg-white text-ink border-2 border-ink rounded shadow-[2px_2px_0px_#171510] hover:bg-cream transition-all"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-punch-red text-cream font-comic text-[9px] w-4 h-4 rounded-full border border-ink flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
};

export default TopNav;

