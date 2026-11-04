import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { EmptyState, LoadingSkeleton } from '../../components/ui/ComicElements';
import { search as searchApi } from '../../services/api';
import { Search, BookOpen, MessageCircle, Megaphone, Users, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [activeTab, setActiveTab] = useState('all'); // all, documents, discussions, announcements, students
  const [results, setResults] = useState({ documents: [], discussions: [], announcements: [], students: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      try {
        const res = await searchApi.globalSearch({ q: query, type: activeTab });
        if (res.data?.success) {
          setResults(res.data.results || { documents: [], discussions: [], announcements: [], students: [] });
        }
      } catch (err) {
        toast.error('Search failed.');
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [query, activeTab]);

  const totalHits =
    (results.documents?.length || 0) +
    (results.discussions?.length || 0) +
    (results.announcements?.length || 0) +
    (results.students?.length || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none">
      {/* Search Header */}
      <div className="comic-box bg-white p-6">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-6 h-6 text-punch-red" />
          <h1 className="font-heading text-3xl uppercase tracking-wide text-ink">
            GLOBAL SEARCH VAULT
          </h1>
        </div>
        <p className="font-sans text-xs text-olive-dark font-medium">
          Showing search results for: <strong className="text-punch-red">"{query}"</strong> ({totalHits} total results found)
        </p>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t-2 border-ink/15">
          {['all', 'documents', 'discussions', 'announcements', 'students'].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`comic-badge text-xs px-3 py-1 uppercase cursor-pointer transition-all ${
                activeTab === t ? 'bg-comic-yellow text-ink font-bold shadow-[2px_2px_0px_#171510]' : 'bg-cream text-ink/70'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : totalHits === 0 ? (
        <EmptyState
          icon="🔍"
          title="NO MATCHES FOUND"
          description={`We couldn't find any documents, discussions, or announcements matching "${query}".`}
        />
      ) : (
        <div className="space-y-6">
          {/* Documents Results */}
          {(activeTab === 'all' || activeTab === 'documents') && results.documents?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-heading text-xl uppercase text-ink">
                <BookOpen className="w-5 h-5 text-punch-red" />
                <span>DOCUMENTS & QUESTION BANKS ({results.documents.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.documents.map((d) => (
                  <Link key={d.id} to={`/document/${d.id}`} className="block">
                    <ComicCard accent="yellow" interactive={true} className="p-4 bg-white">
                      <span className="font-comic text-[10px] bg-comic-yellow text-ink px-1.5 py-0.5 rounded border border-ink">
                        {d.subject_name || 'General'}
                      </span>
                      <h4 className="font-heading text-base uppercase text-ink mt-1 truncate">
                        {d.title}
                      </h4>
                      {d.description && (
                        <p className="font-sans text-xs text-olive-dark line-clamp-1 mt-0.5">
                          {d.description}
                        </p>
                      )}
                    </ComicCard>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Discussions Results */}
          {(activeTab === 'all' || activeTab === 'discussions') && results.discussions?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-heading text-xl uppercase text-ink">
                <MessageCircle className="w-5 h-5 text-punch-red" />
                <span>COMMUNITY MESSAGES ({results.discussions.length})</span>
              </div>
              <div className="space-y-2">
                {results.discussions.map((msg) => (
                  <Link key={msg.id} to="/community" className="block">
                    <div className="comic-box p-3 bg-white hover:bg-cream/40 transition-colors">
                      <div className="flex justify-between items-center text-[10px] font-mono text-ink/70 mb-1">
                        <span>#{msg.channel_name} • By {msg.author_name}</span>
                        <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="font-sans text-xs text-ink font-medium leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Announcements Results */}
          {(activeTab === 'all' || activeTab === 'announcements') && results.announcements?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-heading text-xl uppercase text-ink">
                <Megaphone className="w-5 h-5 text-punch-red" />
                <span>ANNOUNCEMENTS ({results.announcements.length})</span>
              </div>
              <div className="space-y-2">
                {results.announcements.map((a) => (
                  <div key={a.id} className="comic-box p-4 bg-white">
                    <h4 className="font-heading text-base uppercase text-ink">
                      {a.title}
                    </h4>
                    <p className="font-sans text-xs text-olive-dark mt-1">
                      {a.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Students Results */}
          {(activeTab === 'all' || activeTab === 'students') && results.students?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-heading text-xl uppercase text-ink">
                <Users className="w-5 h-5 text-punch-red" />
                <span>STUDENTS ({results.students.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.students.map((s) => (
                  <Link key={s.id} to={`/profile/${s.id}`} className="block">
                    <div className="comic-box p-3 bg-white hover:bg-cream transition-colors flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-comic-yellow text-ink font-heading font-black text-sm flex items-center justify-center border-2 border-ink">
                        {s.full_name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h5 className="font-heading text-sm uppercase text-ink">
                          {s.full_name}
                        </h5>
                        <span className="font-mono text-[10px] text-olive-dark">
                          {s.department || 'Student'} • {s.total_points || 0} pts
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResults;

