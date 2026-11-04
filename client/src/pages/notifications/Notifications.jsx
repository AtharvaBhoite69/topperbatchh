import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { EmptyState, LoadingSkeleton } from '../../components/ui/ComicElements';
import { notifications as notifApi } from '../../services/api';
import { Bell, CheckCheck, Megaphone, Zap, BookOpen, ShieldAlert, Award } from 'lucide-react';
import toast from 'react-hot-toast';

export const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await notifApi.getAll({ limit: 50 });
      if (res.data?.success) {
        setNotifications(res.data.notifications || []);
      }
    } catch (err) {
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notifApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (e) {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notifApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      toast.success('All notifications marked as read.');
    } catch (err) {
      toast.error('Failed to mark notifications.');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'announcement':
        return <Megaphone className="w-5 h-5 text-punch-red" />;
      case 'quiz':
        return <Zap className="w-5 h-5 text-comic-yellow" />;
      case 'document':
        return <BookOpen className="w-5 h-5 text-victory-green" />;
      case 'report':
        return <ShieldAlert className="w-5 h-5 text-punch-red" />;
      default:
        return <Bell className="w-5 h-5 text-ink" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-6 h-6 text-punch-red" />
            <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
              NOTIFICATIONS & ALERTS
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium">
            Stay up to date with batch broadcasts, newly uploaded question banks, and daily competition updates.
          </p>
        </div>

        {notifications.some((n) => n.is_read === 0) && (
          <ComicButton
            variant="yellow"
            size="sm"
            onClick={handleMarkAllRead}
            icon={<CheckCheck className="w-4 h-4" />}
          >
            MARK ALL READ
          </ComicButton>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="NO NOTIFICATIONS"
          description="You are all caught up! When announcements are broadcasted or PDFs are dropped, they'll show up here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isUnread = n.is_read === 0;
            return (
              <div
                key={n.id}
                onClick={() => isUnread && handleMarkRead(n.id)}
                className={`comic-box p-4 flex items-start gap-4 transition-all cursor-pointer ${
                  isUnread
                    ? 'bg-cream border-ink shadow-[4px_4px_0px_#171510] border-l-[6px] border-l-punch-red'
                    : 'bg-white border-ink/40 opacity-80'
                }`}
              >
                <div className="w-10 h-10 rounded-md bg-white border-2 border-ink flex items-center justify-center shadow-[2px_2px_0px_#171510] flex-shrink-0 mt-0.5">
                  {getIcon(n.type)}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading text-base uppercase text-ink">
                      {n.title}
                    </h4>
                    <span className="font-mono text-[10px] text-ink/60">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="font-sans text-xs text-olive-dark font-medium leading-relaxed">
                    {n.message}
                  </p>

                  {n.link && (
                    <Link
                      to={n.link}
                      className="font-comic text-xs uppercase text-punch-red hover:underline block pt-1"
                    >
                      VIEW ATTACHED ITEM →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;

