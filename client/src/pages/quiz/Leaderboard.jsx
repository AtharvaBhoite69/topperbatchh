import React, { useState, useEffect } from 'react';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { ComicBadge, LoadingSkeleton } from '../../components/ui/ComicElements';
import { quiz as quizApi } from '../../services/api';
import { Trophy, Medal, Flame, Zap, Award, Crown, User } from 'lucide-react';
import toast from 'react-hot-toast';

export const Leaderboard = () => {
  const [type, setType] = useState('daily'); // 'daily' | 'weekly' | 'alltime'
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRankings = async () => {
      setLoading(true);
      try {
        const res = await quizApi.getLeaderboard({ type });
        if (res.data?.success) {
          setLeaderboard(res.data.leaderboard || []);
        }
      } catch (err) {
        toast.error('Failed to load leaderboard rankings.');
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, [type]);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none">
      {/* Top Banner */}
      <div className="comic-box bg-white p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-7 h-7 text-comic-yellow fill-comic-yellow" />
            <h1 className="font-heading text-3xl sm:text-4xl uppercase tracking-wide text-ink">
              BATCH LEADERBOARD & HALL OF FAME
            </h1>
          </div>
          <p className="font-sans text-xs text-olive-dark font-medium max-w-xl">
            Ranked by total challenge score with completion time as tiebreaker.
            Reach the top 3 podium for ultimate bragging rights and exclusive badge perks.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1.5 bg-cream border-2 border-ink rounded-lg shadow-[2px_2px_0px_#171510]">
          <button
            onClick={() => setType('daily')}
            className={`comic-badge text-xs px-3 py-1 cursor-pointer transition-all ${
              type === 'daily' ? 'bg-comic-yellow font-black' : 'bg-transparent text-ink/70'
            }`}
          >
            DAILY
          </button>
          <button
            onClick={() => setType('weekly')}
            className={`comic-badge text-xs px-3 py-1 cursor-pointer transition-all ${
              type === 'weekly' ? 'bg-comic-yellow font-black' : 'bg-transparent text-ink/70'
            }`}
          >
            WEEKLY
          </button>
          <button
            onClick={() => setType('alltime')}
            className={`comic-badge text-xs px-3 py-1 cursor-pointer transition-all ${
              type === 'alltime' ? 'bg-comic-yellow font-black' : 'bg-transparent text-ink/70'
            }`}
          >
            ALL-TIME
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : leaderboard.length === 0 ? (
        <div className="comic-box p-8 bg-white text-center">
          <Trophy className="w-12 h-12 text-secondary-grey mx-auto mb-2 opacity-50" />
          <h3 className="font-heading text-xl uppercase text-ink">NO SCORES RECORDED YET</h3>
          <p className="font-sans text-xs text-olive-dark mt-1">
            Be the first to complete today's MCQ battle and claim the #1 spot!
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {/* 2nd Place */}
              {top3[1] && (
                <div className="order-2 md:order-1 comic-box bg-white p-5 text-center flex flex-col items-center justify-between border-t-[6px] border-t-secondary-grey">
                  <div className="w-10 h-10 rounded-full bg-secondary-grey text-ink font-heading font-black flex items-center justify-center border-2 border-ink shadow-[2px_2px_0px_#171510] mb-2">
                    #2
                  </div>
                  <h4 className="font-heading text-lg uppercase text-ink truncate max-w-full">
                    {top3[1].full_name}
                  </h4>
                  <span className="font-mono text-xs text-olive-dark">
                    {top3[1].department || 'Student'}
                  </span>
                  <div className="font-heading text-3xl text-ink mt-3">
                    {top3[1].score} PTS
                  </div>
                </div>
              )}

              {/* 1st Place (Center & Highest) */}
              {top3[0] && (
                <div className="order-1 md:order-2 comic-box-lg bg-comic-yellow p-6 text-center flex flex-col items-center justify-between -translate-y-2 relative shadow-[8px_8px_0px_#171510]">
                  <div className="absolute -top-3.5 bg-punch-red text-cream font-comic text-xs uppercase px-3 py-0.5 rounded border border-ink shadow-[2px_2px_0px_#171510] flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 fill-current" /> TOPPER CHAMPION
                  </div>
                  <div className="w-14 h-14 rounded-full bg-cream text-ink font-heading font-black text-xl flex items-center justify-center border-[3px] border-ink shadow-[3px_3px_0px_#171510] my-2">
                    👑 1
                  </div>
                  <h3 className="font-heading text-2xl uppercase text-ink truncate max-w-full">
                    {top3[0].full_name}
                  </h3>
                  <span className="font-mono text-xs text-ink/80 font-bold">
                    {top3[0].department || 'Student'} • Sem {top3[0].semester || 3}
                  </span>
                  <div className="font-heading text-4xl text-ink mt-3">
                    {top3[0].score} PTS
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <div className="order-3 comic-box bg-white p-5 text-center flex flex-col items-center justify-between border-t-[6px] border-t-punch-red/60">
                  <div className="w-10 h-10 rounded-full bg-cream text-ink font-heading font-black flex items-center justify-center border-2 border-ink shadow-[2px_2px_0px_#171510] mb-2">
                    #3
                  </div>
                  <h4 className="font-heading text-lg uppercase text-ink truncate max-w-full">
                    {top3[2].full_name}
                  </h4>
                  <span className="font-mono text-xs text-olive-dark">
                    {top3[2].department || 'Student'}
                  </span>
                  <div className="font-heading text-3xl text-ink mt-3">
                    {top3[2].score} PTS
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full Ranking Table */}
          <div className="comic-box bg-white overflow-hidden">
            <div className="p-4 border-b-2 border-ink bg-cream font-comic text-xs uppercase text-ink flex items-center justify-between font-bold">
              <span>RANK & STUDENT DETAILS</span>
              <span>SCORE</span>
            </div>

            <div className="divide-y-2 divide-ink/10">
              {leaderboard.map((entry) => (
                <div
                  key={entry.user_id}
                  className={`p-3.5 flex items-center justify-between transition-colors ${
                    entry.isCurrentUser
                      ? 'bg-comic-yellow/30 border-l-[6px] border-l-punch-red font-bold'
                      : 'hover:bg-cream/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded font-heading text-sm flex items-center justify-center border border-ink shadow-[1px_1px_0px_#171510] ${
                        entry.rank <= 3
                          ? 'bg-comic-yellow text-ink font-black'
                          : 'bg-cream text-ink'
                      }`}
                    >
                      {entry.rank}
                    </span>

                    <div>
                      <div className="font-heading text-sm uppercase text-ink flex items-center gap-2">
                        <span>{entry.full_name}</span>
                        {entry.isCurrentUser && (
                          <span className="font-comic text-[10px] bg-punch-red text-cream px-1.5 py-0.2 rounded border border-ink">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-olive-dark">
                        {entry.department || 'Student'} • Sem {entry.semester || 1}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-heading text-lg text-ink font-bold">
                      {entry.score} <span className="text-xs font-normal">PTS</span>
                    </div>
                    {entry.time_taken_seconds !== undefined && (
                      <div className="text-[10px] font-mono text-ink/70">
                        {Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Leaderboard;

