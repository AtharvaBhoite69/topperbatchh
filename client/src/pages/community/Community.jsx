import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import ComicButton from '../../components/ui/ComicButton';
import { ComicBadge } from '../../components/ui/ComicElements';
import { community as commApi } from '../../services/api';
import {
  Megaphone,
  Zap,
  BookOpen,
  Send,
  Reply,
  Pin,
  Trash2,
  Edit2,
  Paperclip,
  Download,
  FileText,
  AlertCircle,
  X,
  Check,
  Lock,
  UploadCloud,
  File,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Community = () => {
  const { user, isAdmin } = useAuth();
  const { socket, onlineCount } = useSocket();

  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typingUser, setTypingUser] = useState(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  // File upload state for Notes & Resources
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Message edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const sbChannelRef = useRef(null);

  // 1. Fetch exactly the 3 community channels
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await commApi.getChannels();
        if (res.data?.success) {
          const chs = res.data.channels || [];
          setChannels(chs);
          if (chs.length > 0) {
            setActiveChannelId(chs[0].id);
          }
        }
      } catch (err) {
        toast.error('Could not load community channels.');
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  // Broadcast helper across Supabase Realtime & Socket.io
  const broadcastEvent = (event, payload) => {
    if (sbChannelRef.current) {
      sbChannelRef.current.send({
        type: 'broadcast',
        event,
        payload,
      });
    }
  };

  // 2. Fetch messages & subscribe to Supabase Realtime + Socket.IO fallback
  useEffect(() => {
    if (!activeChannelId) return;

    let isMounted = true;

    const fetchMessages = async (isBackgroundPoll = false) => {
      try {
        const res = await commApi.getMessages(activeChannelId);
        if (isMounted && res.data?.success) {
          const fresh = res.data.messages || [];
          setMessages((prev) => {
            // Compare items to avoid jumpy UI re-renders
            if (
              prev.length === fresh.length &&
              prev.every(
                (m, i) =>
                  m.id === fresh[i]?.id &&
                  m.content === fresh[i]?.content &&
                  m.is_pinned === fresh[i]?.is_pinned &&
                  JSON.stringify(m.reactions || {}) === JSON.stringify(fresh[i]?.reactions || {})
              )
            ) {
              return prev;
            }
            return fresh;
          });
        }
      } catch (err) {
        if (!isBackgroundPoll) {
          toast.error('Failed to load channel messages.');
        }
      }
    };

    fetchMessages(false);

    // Common event handlers
    const handleNewMessage = (newMsg) => {
      if (newMsg && newMsg.channel_id === activeChannelId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };

    const handleReactionUpdate = ({ messageId, emoji, action, userId }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = { ...(m.reactions || {}) };
          if (!reactions[emoji]) {
            reactions[emoji] = { count: 0, hasReacted: false, users: [] };
          }
          if (action === 'added') {
            reactions[emoji].count++;
            if (userId === user?.id) reactions[emoji].hasReacted = true;
          } else {
            reactions[emoji].count = Math.max(0, reactions[emoji].count - 1);
            if (userId === user?.id) reactions[emoji].hasReacted = false;
          }
          return { ...m, reactions };
        })
      );
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const handleMessageEdited = ({ messageId, content }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content, is_edited: true } : m))
      );
    };

    const handleMessagePinned = ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_pinned: isPinned ? 1 : 0 } : m))
      );
    };

    const handleUserTyping = ({ username, isTyping }) => {
      if (isTyping) {
        setTypingUser(username);
      } else {
        setTypingUser(null);
      }
    };

    // A. SUPABASE REALTIME SUBSCRIPTION
    if (isSupabaseConfigured && supabase) {
      const channelName = `community-room-${activeChannelId}`;
      const sbChannel = supabase
        .channel(channelName, {
          config: {
            broadcast: { ack: false },
          },
        })
        .on('broadcast', { event: 'new_message' }, ({ payload }) => handleNewMessage(payload))
        .on('broadcast', { event: 'reaction_update' }, ({ payload }) => handleReactionUpdate(payload))
        .on('broadcast', { event: 'message_deleted' }, ({ payload }) => handleMessageDeleted(payload))
        .on('broadcast', { event: 'message_edited' }, ({ payload }) => handleMessageEdited(payload))
        .on('broadcast', { event: 'message_pinned' }, ({ payload }) => handleMessagePinned(payload))
        .on('broadcast', { event: 'user_typing' }, ({ payload }) => handleUserTyping(payload))
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'community_messages',
            filter: `channel_id=eq.${activeChannelId}`,
          },
          (payload) => {
            // Postgres change listener ensures 100% data sync across multiple serverless instances
            fetchMessages(true);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsRealtimeActive(true);
            fetchMessages(true); // Recover any missed messages upon connecting
          } else {
            setIsRealtimeActive(false);
          }
        });

      sbChannelRef.current = sbChannel;
    }

    // B. SOCKET.IO FALLBACK (For offline local development)
    if (socket) {
      socket.emit('join_channel', activeChannelId);
      socket.on('new_message', handleNewMessage);
      socket.on('reaction_update', handleReactionUpdate);
      socket.on('message_deleted', handleMessageDeleted);
      socket.on('message_edited', handleMessageEdited);
      socket.on('message_pinned', handleMessagePinned);
      socket.on('user_typing', handleUserTyping);
    }

    // C. POLLING RECOVERY: Periodic check (every 5 seconds) to guarantee no dropped messages
    const pollInterval = setInterval(() => {
      fetchMessages(true);
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);

      if (sbChannelRef.current && supabase) {
        supabase.removeChannel(sbChannelRef.current);
        sbChannelRef.current = null;
      }

      if (socket) {
        socket.emit('leave_channel', activeChannelId);
        socket.off('new_message', handleNewMessage);
        socket.off('reaction_update', handleReactionUpdate);
        socket.off('message_deleted', handleMessageDeleted);
        socket.off('message_edited', handleMessageEdited);
        socket.off('message_pinned', handleMessagePinned);
        socket.off('user_typing', handleUserTyping);
      }
    };
  }, [activeChannelId, socket, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const isAnnouncements = activeChannel?.name === 'Announcements';
  const isNotesAndResources = activeChannel?.name === 'Notes & Resources';
  const canInteract = !isAnnouncements || isAdmin;

  // Format file size
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Channel Icon Selector
  const getChannelIcon = (name) => {
    switch (name) {
      case 'Announcements':
        return <Megaphone className="w-4 h-4 text-punch-red flex-shrink-0" />;
      case 'Exam Discussion':
        return <Zap className="w-4 h-4 text-comic-yellow flex-shrink-0" />;
      case 'Notes & Resources':
        return <BookOpen className="w-4 h-4 text-victory-green flex-shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-punch-red flex-shrink-0" />;
    }
  };

  // Send message or upload file
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !attachedFile) || !activeChannelId) return;

    if (isAnnouncements && !isAdmin) {
      toast.error('Only permanent administrators can post in Announcements.');
      return;
    }

    try {
      setIsUploading(true);

      if (attachedFile) {
        // Upload with attachment
        const formData = new FormData();
        formData.append('file', attachedFile);
        if (inputText.trim()) {
          formData.append('content', inputText.trim());
        }

        const res = await commApi.uploadFile(activeChannelId, formData);
        if (res.data?.success && res.data.message) {
          const sentMsg = res.data.message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === sentMsg.id)) return prev;
            return [...prev, sentMsg];
          });
          broadcastEvent('new_message', sentMsg);
          toast.success('Resource shared with batch!');
        }
        setAttachedFile(null);
      } else {
        // Text-only message
        const payload = {
          content: inputText.trim(),
          reply_to_id: replyTo ? replyTo.id : null,
        };

        const res = await commApi.sendMessage(activeChannelId, payload);
        if (res.data?.success && res.data.message) {
          const sentMsg = res.data.message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === sentMsg.id)) return prev;
            return [...prev, sentMsg];
          });
          broadcastEvent('new_message', sentMsg);
        }
      }

      setInputText('');
      setReplyTo(null);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to send message.';
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  // Toggle emoji reaction (Announcements: admin only)
  const handleToggleReaction = async (msgId, emoji) => {
    if (isAnnouncements && !isAdmin) {
      toast.error('Reactions are disabled in the Announcements channel.');
      return;
    }

    try {
      const res = await commApi.toggleReaction(activeChannelId, msgId, { emoji });
      if (res.data?.success) {
        const action = res.data.action;
        const reactionPayload = { messageId: msgId, emoji, action, userId: user?.id };
        broadcastEvent('reaction_update', reactionPayload);

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId) return m;
            const reactions = { ...(m.reactions || {}) };
            if (!reactions[emoji]) {
              reactions[emoji] = { count: 0, hasReacted: false, users: [] };
            }
            if (action === 'added') {
              reactions[emoji].count++;
              reactions[emoji].hasReacted = true;
            } else {
              reactions[emoji].count = Math.max(0, reactions[emoji].count - 1);
              reactions[emoji].hasReacted = false;
            }
            return { ...m, reactions };
          })
        );
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Could not update reaction.';
      toast.error(errMsg);
    }
  };

  // Delete message
  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await commApi.deleteMessage(activeChannelId, msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      broadcastEvent('message_deleted', { messageId: msgId });
      toast.success('Message removed.');
    } catch (err) {
      toast.error('Could not delete message.');
    }
  };

  // Edit message
  const handleSaveEdit = async (msgId) => {
    if (!editContent.trim()) return;
    try {
      await commApi.editMessage(activeChannelId, msgId, { content: editContent.trim() });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, content: editContent.trim(), is_edited: true } : m))
      );
      broadcastEvent('message_edited', { messageId: msgId, content: editContent.trim() });
      setEditingMessageId(null);
      setEditContent('');
      toast.success('Message updated.');
    } catch (err) {
      toast.error('Could not update message.');
    }
  };

  // Pin message (Admin only)
  const handlePinToggle = async (msgId) => {
    try {
      const res = await commApi.pinMessage(activeChannelId, msgId);
      if (res.data?.success) {
        const isPinned = res.data.isPinned ? 1 : 0;
        toast.success(res.data.message || 'Pinned status updated.');
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, is_pinned: isPinned } : m))
        );
        broadcastEvent('message_pinned', { messageId: msgId, isPinned: !!isPinned });
      }
    } catch (err) {
      toast.error('Could not pin message.');
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!isAnnouncements) {
      const username = user?.full_name?.split(' ')[0] || 'A student';
      broadcastEvent('user_typing', { channelId: activeChannelId, username, isTyping: true });

      if (socket && socket.connected) {
        socket.emit('typing', { channelId: activeChannelId, username });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        broadcastEvent('user_typing', { channelId: activeChannelId, username, isTyping: false });
        if (socket && socket.connected) {
          socket.emit('stop_typing', { channelId: activeChannelId });
        }
      }, 2000);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error('File size must be under 15MB.');
        return;
      }
      setAttachedFile(file);
    }
  };

  const commonEmojis = ['🔥', '💡', '👍', '❤️', '👏', '🚀'];

  return (
    <div className="flex h-[calc(100vh-140px)] border-[3px] border-ink bg-white shadow-comic overflow-hidden">
      {/* 1. Channels Sidebar */}
      <div className="w-64 sm:w-72 border-r-[3px] border-ink bg-cream/40 flex flex-col flex-shrink-0">
        <div className="p-4 border-b-[3px] border-ink bg-comic-yellow flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-lg uppercase tracking-wide text-ink">CHANNELS</h3>
            <span className="font-mono text-xs bg-ink text-white px-1.5 py-0.5 rounded font-bold">3</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full border border-ink ${
                isRealtimeActive ? 'bg-victory-green animate-pulse' : 'bg-punch-red'
              }`}
              title={isRealtimeActive ? 'Supabase Realtime Live' : 'Polling Live Sync'}
            />
            <span className="font-comic text-[10px] uppercase text-ink font-bold">
              {isRealtimeActive ? 'REALTIME' : 'LIVE'}
            </span>
          </div>
        </div>

        {/* Official 3 Channels List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="p-4 text-center font-comic text-xs uppercase text-olive-dark">
              Loading channels...
            </div>
          ) : (
            channels.map((chan) => {
              const isActive = chan.id === activeChannelId;
              const isOfficialAnnouncements = chan.name === 'Announcements';

              return (
                <button
                  key={chan.id}
                  onClick={() => {
                    setActiveChannelId(chan.id);
                    setReplyTo(null);
                    setAttachedFile(null);
                  }}
                  className={`w-full text-left p-3 rounded border-2 transition-all flex items-start gap-2.5 ${
                    isActive
                      ? 'bg-ink text-cream border-ink shadow-[3px_3px_0px_#171510]'
                      : 'bg-white text-ink border-ink/40 hover:border-ink hover:bg-comic-yellow/20'
                  }`}
                >
                  <div className="mt-0.5">{getChannelIcon(chan.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-xs sm:text-sm uppercase tracking-wide truncate font-bold">
                        {chan.name}
                      </span>
                      {isOfficialAnnouncements && (
                        <span className="font-comic text-[8px] bg-punch-red text-cream px-1 py-0.2 rounded border border-ink uppercase">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[10px] font-sans truncate mt-0.5 ${
                        isActive ? 'text-cream/80' : 'text-olive-dark'
                      }`}
                    >
                      {chan.description}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Live Status Footer */}
        <div className="p-3 border-t-[3px] border-ink bg-white font-mono text-[11px] text-ink flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-victory-green animate-pulse" />
            <span className="font-heading uppercase text-xs">ONLINE BATCH:</span>
          </div>
          <span className="font-bold text-punch-red">{onlineCount || 1} ACTIVE</span>
        </div>
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Channel Header Banner */}
        <div className="p-3 sm:p-4 border-b-[3px] border-ink bg-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-cream border-2 border-ink flex items-center justify-center shadow-[2px_2px_0px_#171510]">
              {getChannelIcon(activeChannel?.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg sm:text-xl uppercase tracking-wide text-ink">
                  #{activeChannel?.name || 'COMMUNITY ARENA'}
                </h2>
                {isAnnouncements && (
                  <span className="font-comic text-[10px] bg-punch-red text-cream px-2 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510]">
                    OFFICIAL BROADCASTS ONLY
                  </span>
                )}
                {isNotesAndResources && (
                  <span className="font-comic text-[10px] bg-victory-green text-cream px-2 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510]">
                    AUTHORIZED RESOURCE VAULT
                  </span>
                )}
              </div>
              <span className="font-sans text-xs text-olive-dark font-medium hidden sm:inline">
                {activeChannel?.description}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink/70 bg-cream px-2.5 py-1 rounded border-2 border-ink shadow-[1px_1px_0px_#171510]">
              {messages.length} Posts
            </span>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-cream/30">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-olive-dark max-w-md mx-auto">
              <div className="w-14 h-14 bg-comic-yellow border-[3px] border-ink rounded-full mx-auto flex items-center justify-center mb-3 shadow-[3px_3px_0px_#171510]">
                {getChannelIcon(activeChannel?.name)}
              </div>
              <h4 className="font-heading text-xl uppercase text-ink">
                WELCOME TO #{activeChannel?.name || 'CHANNEL'}
              </h4>
              <p className="text-xs font-sans mt-1 text-vintage-olive font-medium leading-relaxed">
                {isAnnouncements
                  ? 'No official announcements posted yet. Permanent administrators broadcast critical semester updates here.'
                  : isNotesAndResources
                  ? 'No study materials uploaded yet. Be the first to share notes, PDF question banks, or formula sheets!'
                  : 'Start of exam discussion. Drop your questions, doubts, or preparation updates for the batch!'}
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.user_id === user?.id;
              const isAuthorAdmin = m.author_role === 'admin';
              const isEditing = editingMessageId === m.id;

              return (
                <div
                  key={m.id}
                  className={`group flex items-start gap-3 text-left transition-all ${
                    m.is_pinned ? 'p-3 bg-comic-yellow/15 rounded border-2 border-comic-yellow' : ''
                  }`}
                >
                  {/* Author Avatar */}
                  <div
                    className={`w-9 h-9 rounded-md font-heading font-black text-xs flex items-center justify-center border-2 border-ink shadow-[2px_2px_0px_#171510] flex-shrink-0 mt-0.5 ${
                      isAuthorAdmin ? 'bg-punch-red text-cream' : 'bg-comic-yellow text-ink'
                    }`}
                  >
                    {m.author_name ? m.author_name.slice(0, 2).toUpperCase() : 'ST'}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header info */}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-heading text-xs uppercase text-ink font-bold">
                        {m.author_name}
                      </span>
                      {isAuthorAdmin && (
                        <span className="font-comic text-[9px] bg-punch-red text-cream px-1.5 py-0.2 rounded border border-ink">
                          ADMIN
                        </span>
                      )}
                      {m.is_pinned === 1 && (
                        <span className="font-comic text-[9px] bg-comic-yellow text-ink px-1.5 py-0.2 rounded border border-ink font-bold flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5 fill-current" /> PINNED
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-ink/60">
                        {new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {m.updated_at && m.updated_at !== m.created_at && (
                        <span className="font-mono text-[9px] text-olive-dark italic">(edited)</span>
                      )}
                    </div>

                    {/* Reply banner if present */}
                    {m.reply_to_author && (
                      <div className="mb-1 text-[11px] font-sans text-olive-dark border-l-2 border-punch-red pl-2 italic">
                        Replying to <strong>{m.reply_to_author}</strong>: "{m.reply_to_snippet}"
                      </div>
                    )}

                    {/* Content or Edit Box */}
                    {isEditing ? (
                      <div className="comic-box p-3 bg-white space-y-2 max-w-xl">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="comic-input text-xs sm:text-sm w-full p-2"
                          rows={3}
                        />
                        <div className="flex items-center gap-2">
                          <ComicButton
                            variant="green"
                            size="sm"
                            onClick={() => handleSaveEdit(m.id)}
                            icon={<Check className="w-3.5 h-3.5" />}
                          >
                            SAVE
                          </ComicButton>
                          <ComicButton
                            variant="white"
                            size="sm"
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditContent('');
                            }}
                          >
                            CANCEL
                          </ComicButton>
                        </div>
                      </div>
                    ) : (
                      <div className="comic-box-sm p-3 bg-white text-xs sm:text-sm font-sans text-ink leading-relaxed inline-block max-w-2xl break-words">
                        {m.content}
                      </div>
                    )}

                    {/* File Attachment Card (for Notes & Resources or attached files) */}
                    {m.attachment_url && (
                      <div className="mt-2 comic-box p-3 bg-cream max-w-md flex items-center justify-between gap-3 border-[2px] border-ink shadow-[3px_3px_0px_#171510]">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-9 h-9 rounded bg-victory-green text-cream flex items-center justify-center border border-ink flex-shrink-0">
                            <File className="w-5 h-5" />
                          </div>
                          <div className="truncate">
                            <div className="font-heading text-xs uppercase text-ink truncate font-bold">
                              {m.attachment_name || 'Shared Resource'}
                            </div>
                            <div className="font-mono text-[10px] text-olive-dark">
                              {formatBytes(m.attachment_size)} • {m.attachment_type?.split('/')[1]?.toUpperCase() || 'DOCUMENT'}
                            </div>
                          </div>
                        </div>

                        <a
                          href={m.attachment_url}
                          download={m.attachment_name || 'resource'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="comic-btn comic-btn-sm comic-btn-yellow flex items-center gap-1 text-xs flex-shrink-0"
                          title="Download authorized resource"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>GET</span>
                        </a>
                      </div>
                    )}

                    {/* Reactions & Actions Row */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {/* Existing Reactions */}
                      {Object.entries(m.reactions || {}).map(([emoji, data]) => {
                        if (!data || data.count === 0) return null;
                        return (
                          <button
                            key={emoji}
                            disabled={!canInteract}
                            onClick={() => handleToggleReaction(m.id, emoji)}
                            className={`px-2 py-0.5 rounded-full border text-xs font-mono flex items-center gap-1 transition-all ${
                              data.hasReacted
                                ? 'bg-comic-yellow border-ink font-bold shadow-[1px_1px_0px_#171510]'
                                : 'bg-white border-ink/40 text-ink hover:border-ink'
                            } ${!canInteract ? 'cursor-default opacity-80' : ''}`}
                          >
                            <span>{emoji}</span>
                            <span>{data.count}</span>
                          </button>
                        );
                      })}

                      {/* Action Bar (Only shown if student/admin is permitted to interact) */}
                      {canInteract && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2">
                          {/* Quick Reactions */}
                          {commonEmojis.slice(0, 3).map((e) => (
                            <button
                              key={e}
                              onClick={() => handleToggleReaction(m.id, e)}
                              className="text-xs hover:scale-125 transition-transform"
                            >
                              {e}
                            </button>
                          ))}

                          {/* Reply Button (Only allowed in non-announcement channels) */}
                          {!isAnnouncements && (
                            <button
                              onClick={() => setReplyTo(m)}
                              className="p-1 hover:text-punch-red text-ink/70"
                              title="Reply to message"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit (Author or Admin) */}
                          {(isMe || isAdmin) && (
                            <button
                              onClick={() => {
                                setEditingMessageId(m.id);
                                setEditContent(m.content);
                              }}
                              className="p-1 hover:text-victory-green text-ink/70"
                              title="Edit message"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Pin (Admin only) */}
                          {isAdmin && (
                            <button
                              onClick={() => handlePinToggle(m.id)}
                              className="p-1 hover:text-comic-yellow text-ink/70"
                              title={m.is_pinned ? 'Unpin message' : 'Pin to top'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete (Author or Admin) */}
                          {(isMe || isAdmin) && (
                            <button
                              onClick={() => handleDeleteMessage(m.id)}
                              className="p-1 hover:text-punch-red text-ink/70"
                              title="Delete message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingUser && (
          <div className="px-4 py-1 text-[11px] font-mono text-olive-dark bg-cream/70 border-t border-ink/20 italic animate-pulse">
            ✍️ {typingUser} is preparing a message...
          </div>
        )}

        {/* Reply preview banner */}
        {replyTo && (
          <div className="px-4 py-2 bg-comic-yellow/30 border-t-2 border-ink flex items-center justify-between text-xs font-sans">
            <span>
              Replying to <strong>{replyTo.author_name}</strong>: "{replyTo.content.slice(0, 40)}..."
            </span>
            <button onClick={() => setReplyTo(null)} className="hover:text-punch-red">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attachment preview banner */}
        {attachedFile && (
          <div className="px-4 py-2 bg-cream border-t-2 border-ink flex items-center justify-between text-xs font-sans">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-victory-green" />
              <span className="font-heading uppercase truncate">{attachedFile.name}</span>
              <span className="font-mono text-olive-dark">({formatBytes(attachedFile.size)})</span>
            </div>
            <button onClick={() => setAttachedFile(null)} className="text-punch-red font-bold hover:underline">
              REMOVE
            </button>
          </div>
        )}

        {/* Composer OR Read-Only Notice for Announcements */}
        {isAnnouncements && !isAdmin ? (
          <div className="p-4 bg-cream border-t-[3px] border-ink flex items-center justify-center gap-2.5 text-center font-comic text-xs sm:text-sm uppercase tracking-wider text-olive-dark">
            <Lock className="w-4 h-4 text-punch-red" />
            <span>ANNOUNCEMENTS CHANNEL (READ ONLY) • ONLY PERMANENT ADMINISTRATORS CAN POST BROADCASTS</span>
          </div>
        ) : (
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-cream border-t-[3px] border-ink flex items-center gap-2"
          >
            {/* File Attachment Trigger (specially designed for Notes & Resources) */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.zip,image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`p-2 rounded border-2 border-ink transition-all shadow-[2px_2px_0px_#171510] ${
                attachedFile
                  ? 'bg-victory-green text-cream'
                  : 'bg-white text-ink hover:bg-comic-yellow'
              }`}
              title="Attach study material, notes, or PDF (Max 15MB)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              placeholder={
                isAnnouncements
                  ? 'Broadcast official admin announcement to batch...'
                  : isNotesAndResources
                  ? 'Add notes description or resource title...'
                  : `Discuss in #${activeChannel?.name || 'channel'}...`
              }
              value={inputText}
              onChange={handleInputChange}
              className="comic-input text-xs sm:text-sm bg-white flex-1"
            />

            <ComicButton
              type="submit"
              variant={isAnnouncements ? 'red' : 'yellow'}
              size="md"
              disabled={(!inputText.trim() && !attachedFile) || isUploading}
              loading={isUploading}
              icon={<Send className="w-4 h-4" />}
            >
              {isAnnouncements ? 'BROADCAST' : 'SEND'}
            </ComicButton>
          </form>
        )}
      </div>
    </div>
  );
};

export default Community;
