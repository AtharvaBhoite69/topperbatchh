import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
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
  ShieldCheck
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

  // File upload state for Notes & Resources
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Message edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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

  // 2. Fetch messages, subscribe to socket room, and auto-poll every 2.5s for Vercel serverless live sync
  useEffect(() => {
    if (!activeChannelId) return;

    let isMounted = true;

    const fetchMessages = async (isBackgroundPoll = false) => {
      try {
        const res = await commApi.getMessages(activeChannelId);
        if (isMounted && res.data?.success) {
          const fresh = res.data.messages || [];
          setMessages((prev) => {
            // Only update state if message IDs or contents changed to avoid unnecessary re-renders
            if (
              prev.length === fresh.length &&
              prev.every((m, i) => m.id === fresh[i]?.id && m.content === fresh[i]?.content && m.is_pinned === fresh[i]?.is_pinned)
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

    // Smart fallback polling: only polls if Socket.IO is disconnected or unavailable
    const pollInterval = setInterval(() => {
      if (!socket || !socket.connected) {
        fetchMessages(true);
      }
    }, 3500);

    if (socket) {
      socket.emit('join_channel', activeChannelId);

      const handleNewMessage = (newMsg) => {
        if (newMsg.channel_id === activeChannelId) {
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
              reactions[emoji] = { count: 0, hasReacted: false };
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

      socket.on('new_message', handleNewMessage);
      socket.on('reaction_update', handleReactionUpdate);
      socket.on('message_deleted', handleMessageDeleted);
      socket.on('message_edited', handleMessageEdited);
      socket.on('message_pinned', handleMessagePinned);
      socket.on('user_typing', handleUserTyping);

      return () => {
        isMounted = false;
        clearInterval(pollInterval);
        socket.emit('leave_channel', activeChannelId);
        socket.off('new_message', handleNewMessage);
        socket.off('reaction_update', handleReactionUpdate);
        socket.off('message_deleted', handleMessageDeleted);
        socket.off('message_edited', handleMessageEdited);
        socket.off('message_pinned', handleMessagePinned);
        socket.off('user_typing', handleUserTyping);
      };
    }

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [activeChannelId, socket, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const isAnnouncements = activeChannel?.name === 'Announcements';
  const isNotesAndResources = activeChannel?.name === 'Notes & Resources';

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
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.data.message.id)) return prev;
            return [...prev, res.data.message];
          });
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
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.data.message.id)) return prev;
            return [...prev, res.data.message];
          });
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

  // Toggle emoji reaction
  const handleToggleReaction = async (msgId, emoji) => {
    try {
      await commApi.toggleReaction(activeChannelId, msgId, { emoji });
    } catch (err) {
      // ignore
    }
  };

  // Delete message
  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await commApi.deleteMessage(activeChannelId, msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
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
        prev.map((m) => (m.id === msgId ? { ...m, content: editContent.trim() } : m))
      );
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
        toast.success(res.data.message || 'Pinned status updated.');
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, is_pinned: res.data.isPinned ? 1 : 0 } : m))
        );
      }
    } catch (err) {
      toast.error('Could not pin message.');
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (socket && activeChannelId && !isAnnouncements) {
      socket.emit('typing', {
        channelId: activeChannelId,
        username: user?.full_name?.split(' ')[0] || 'A student',
        isTyping: true,
      });

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', {
          channelId: activeChannelId,
          username: user?.full_name?.split(' ')[0],
          isTyping: false,
        });
      }, 1500);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File exceeds maximum 15MB limit.');
      return;
    }

    setAttachedFile(file);
    toast.success(`Attached: ${file.name}`);
  };

  const commonEmojis = ['🔥', '💯', '🚀', '🧠', '👍', '🎯'];

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-100px)] text-left select-none">
      {/* Channels Sidebar (Retro Comic Style) */}
      <div className="w-full lg:w-72 comic-box bg-vintage-olive text-cream p-4 flex flex-col justify-between flex-shrink-0 border-[3px] border-ink shadow-[5px_5px_0px_#171510]">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b-2 border-ink mb-3.5">
            <div>
              <span className="font-comic text-[11px] text-comic-yellow font-bold uppercase tracking-widest block">
                TOPPERBATCH COMMUNITY
              </span>
              <h2 className="font-heading text-xl uppercase tracking-wide text-cream">
                BATCH CHANNELS
              </h2>
            </div>
            <span className="font-comic text-[10px] bg-victory-green text-cream px-2 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510]">
              {onlineCount} ONLINE
            </span>
          </div>

          {/* Exact 3 Channels List in Order */}
          <div className="space-y-2">
            {channels.map((ch, idx) => {
              const isActive = ch.id === activeChannelId;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannelId(ch.id)}
                  className={`w-full flex items-center justify-between p-3 rounded border-[3px] border-ink transition-all text-left ${
                    isActive
                      ? 'bg-comic-yellow text-ink shadow-[4px_4px_0px_#171510] translate-x-1 font-bold'
                      : 'bg-white text-ink hover:bg-cream shadow-[2px_2px_0px_#171510]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-5 h-5 rounded bg-ink text-comic-yellow flex items-center justify-center font-heading text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-heading text-sm uppercase tracking-wide truncate flex items-center gap-1.5">
                        {ch.name}
                      </div>
                      <div className="text-[10px] font-sans text-olive-dark truncate font-medium">
                        {ch.name === 'Announcements' && 'Admin broadcasts only'}
                        {ch.name === 'Exam Discussion' && 'Doubts & exam topics'}
                        {ch.name === 'Notes & Resources' && 'PDFs, materials & links'}
                      </div>
                    </div>
                  </div>

                  {ch.name === 'Announcements' && (
                    <span className="font-comic text-[9px] bg-punch-red text-cream px-1.5 py-0.5 rounded border border-ink flex-shrink-0">
                      ADMIN
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Channel Guideline Footer */}
        <div className="pt-3 border-t-2 border-ink/40 text-[11px] font-mono text-cream/80 bg-ink/30 p-2.5 rounded border border-ink">
          <div className="font-bold text-comic-yellow flex items-center gap-1 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-comic-yellow" /> THREE CORE CHANNELS
          </div>
          <div>1. Announcements (Admin)</div>
          <div>2. Exam Discussion (Batch)</div>
          <div>3. Notes & Resources (Vault)</div>
        </div>
      </div>

      {/* Main Channel Message Feed Area */}
      <div className="flex-1 comic-box bg-white flex flex-col justify-between overflow-hidden shadow-[6px_6px_0px_#171510] border-[4px] border-ink">
        {/* Channel Header */}
        <div className="p-3.5 sm:p-4 border-b-[3px] border-ink bg-cream flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-white border-2 border-ink flex items-center justify-center shadow-[2px_2px_0px_#171510]">
              {getChannelIcon(activeChannel?.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl uppercase tracking-wide text-ink">
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
              <span className="font-sans text-xs text-olive-dark font-medium">
                {activeChannel?.description}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="font-mono text-xs text-ink/70 bg-white px-2.5 py-1 rounded border-2 border-ink shadow-[1px_1px_0px_#171510]">
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
                  ? 'No official announcements posted yet. Administrators will broadcast critical semester updates here.'
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
                            onClick={() => handleToggleReaction(m.id, emoji)}
                            className={`px-2 py-0.5 rounded-full border text-xs font-mono flex items-center gap-1 transition-all ${
                              data.hasReacted
                                ? 'bg-comic-yellow border-ink font-bold shadow-[1px_1px_0px_#171510]'
                                : 'bg-white border-ink/40 text-ink hover:border-ink'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{data.count}</span>
                          </button>
                        );
                      })}

                      {/* Action Bar */}
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

                        {/* Edit Button (Author or Admin) */}
                        {(isMe || (isAdmin && isAnnouncements)) && (
                          <button
                            onClick={() => {
                              setEditingMessageId(m.id);
                              setEditContent(m.content);
                            }}
                            className="p-1 hover:text-comic-yellow text-ink/70"
                            title="Edit message"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Pin Button (Admins only) */}
                        {isAdmin && (
                          <button
                            onClick={() => handlePinToggle(m.id)}
                            className={`p-1 hover:text-punch-red ${
                              m.is_pinned ? 'text-punch-red' : 'text-ink/70'
                            }`}
                            title={m.is_pinned ? 'Unpin message' : 'Pin message'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Button (Author or Admin) */}
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
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingUser && !isAnnouncements && (
          <div className="px-4 py-1 text-[11px] font-comic text-punch-red uppercase tracking-wider bg-cream/70">
            ✍️ {typingUser} is typing...
          </div>
        )}

        {/* Replying banner */}
        {replyTo && (
          <div className="px-4 py-1.5 bg-comic-yellow border-t-2 border-ink flex items-center justify-between text-xs font-sans">
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
