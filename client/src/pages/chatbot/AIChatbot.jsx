import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ComicButton from '../../components/ui/ComicButton';
import ComicCard from '../../components/ui/ComicCard';
import { ComicBadge } from '../../components/ui/ComicElements';
import { chatbot as chatApi, documents as docApi } from '../../services/api';
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Copy,
  Check,
  FileText,
  Sparkles,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AIChatbot = () => {
  const [searchParams] = useSearchParams();
  const preSelectedDocId = searchParams.get('doc');

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(preSelectedDocId || '');

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const messagesEndRef = useRef(null);

  // Load conversations and available documents
  useEffect(() => {
    const init = async () => {
      try {
        const [convRes, docsRes] = await Promise.all([
          chatApi.getConversations(),
          docApi.list({ limit: 100 }),
        ]);

        if (docsRes.data?.success) {
          setDocuments(docsRes.data.documents || []);
        }

        if (convRes.data?.success) {
          const convs = convRes.data.conversations || [];
          setConversations(convs);

          // If preselected doc passed or conversations exist
          if (preSelectedDocId) {
            startNewChat(preSelectedDocId);
          } else if (convs.length > 0) {
            loadConversation(convs[0].id);
          }
        }
      } catch (err) {
        console.error('Chat init error:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const loadConversation = async (convId) => {
    try {
      setActiveConvId(convId);
      setMobileDrawerOpen(false);
      const res = await chatApi.getConversation(convId);
      if (res.data?.success) {
        setMessages(res.data.messages || []);
        if (res.data.conversation?.document_id) {
          setSelectedDocId(res.data.conversation.document_id);
        }
      }
    } catch (err) {
      toast.error('Failed to load conversation history.');
    }
  };

  const startNewChat = async (docIdToUse) => {
    try {
      const docId = docIdToUse || selectedDocId || null;
      setMobileDrawerOpen(false);
      const res = await chatApi.createConversation({ document_id: docId });
      if (res.data?.success) {
        const newConv = res.data.conversation;
        setConversations((prev) => [newConv, ...prev]);
        setActiveConvId(newConv.id);
        setMessages([]);
      }
    } catch (err) {
      toast.error('Could not create new chat.');
    }
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      await chatApi.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        const remaining = conversations.filter((c) => c.id !== convId);
        if (remaining.length > 0) {
          loadConversation(remaining[0].id);
        } else {
          setActiveConvId(null);
          setMessages([]);
        }
      }
      toast.success('Conversation removed.');
    } catch (err) {
      toast.error('Could not delete conversation.');
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || sending) return;

    let convId = activeConvId;
    if (!convId) {
      try {
        const res = await chatApi.createConversation({ document_id: selectedDocId || null });
        if (res.data?.success) {
          convId = res.data.conversation.id;
          setActiveConvId(convId);
          setConversations((prev) => [res.data.conversation, ...prev]);
        }
      } catch (err) {
        toast.error('Could not initiate conversation session.');
        return;
      }
    }

    const optimisticUserMsg = {
      id: `temp_usr_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    const streamMsgId = `temp_ast_${Date.now()}`;
    const optimisticAssistantMsg = {
      id: streamMsgId,
      role: 'assistant',
      content: '',
      sources: [],
      isStreaming: true,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg, optimisticAssistantMsg]);
    setInputText('');
    setSending(true);

    try {
      const token = localStorage.getItem('topperbatch_token') || '';
      const response = await fetch(`/api/chatbot/conversations/${convId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          content: text.trim(),
          document_id: selectedDocId || null,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Streaming connection failed, falling back to standard request.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep remainder

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          try {
            const data = JSON.parse(trimmed.slice(5).trim());

            if (data.type === 'sources' && Array.isArray(data.sources)) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId ? { ...m, sources: data.sources } : m
                )
              );
            } else if (data.type === 'token' && typeof data.token === 'string') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId
                    ? { ...m, content: (m.content || '') + data.token }
                    : m
                )
              );
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            } else if (data.type === 'done' && data.message) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId
                    ? {
                        ...data.message,
                        isStreaming: false,
                      }
                    : m
                )
              );
            }
          } catch (_) {}
        }
      }
    } catch (streamErr) {
      // Fallback to standard JSON endpoint
      try {
        const res = await chatApi.sendMessage(convId, {
          content: text.trim(),
          document_id: selectedDocId || null,
        });

        if (res.data?.success && res.data.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === streamMsgId ? res.data.message : m))
          );
        }
      } catch (fallbackErr) {
        // Remove empty assistant placeholder and restore user prompt for easy retry
        setMessages((prev) => prev.filter((m) => m.id !== streamMsgId));
        setInputText(text);
        toast.error('AI response failed. Please verify that your GEMINI_API_KEY is active.');
      }
    } finally {
      setSending(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied response to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selectedDocObj = documents.find((d) => d.id === selectedDocId);

  const suggestedQuestions = [
    'Give me the answer to Question 10 from DBMS QB with steps.',
    'Explain the core concepts from Unit 1 with real exam examples in simple words.',
    'Summarize this question bank into high-yield 9-pointer bullet points.',
    'Generate 5 practice exam MCQs with explanations from this material.',
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 h-[calc(100dvh-120px)] sm:h-[calc(100vh-100px)] text-left relative">
      {/* Left Sidebar: Conversations & Document Filter (Collapsible on Mobile) */}
      <div
        className={`w-full lg:w-72 comic-box bg-white p-3 sm:p-4 flex-col justify-between flex-shrink-0 z-30 transition-all ${
          mobileDrawerOpen ? 'flex max-h-[65vh] border-4 shadow-[6px_6px_0px_#171510]' : 'hidden lg:flex'
        }`}
      >
        <div>
          {/* Mobile Drawer Close Button */}
          <div className="lg:hidden flex items-center justify-between pb-2 mb-2 border-b border-ink/20">
            <span className="font-heading text-sm text-ink uppercase">AI SESSIONS & RAG</span>
            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="text-xs font-comic text-punch-red font-bold hover:underline"
            >
              ✕ BACK TO CHAT
            </button>
          </div>

          {/* New Chat Button */}
          <ComicButton
            variant="yellow"
            size="md"
            className="w-full mb-3 text-xs sm:text-sm"
            onClick={() => startNewChat()}
            icon={<Plus className="w-4 h-4" />}
          >
            NEW AI CHAT
          </ComicButton>

          {/* Target Document Picker */}
          <div className="mb-4">
            <label className="font-comic text-xs uppercase tracking-wide text-ink block mb-1">
              GROUND TO DOCUMENT (RAG):
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="comic-input text-xs py-1.5 bg-cream font-mono truncate"
            >
              <option value="">All Question Banks (Global)</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.subject_name || 'Doc'})
                </option>
              ))}
            </select>
          </div>

          {/* Conversation History List */}
          <div className="font-comic text-xs uppercase text-ink/70 mb-2 border-b border-ink/20 pb-1">
            PAST SESSIONS ({conversations.length})
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[35vh] lg:max-h-[55vh] pr-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-olive-dark font-sans py-2">No past conversations.</p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={`p-2.5 rounded border-2 cursor-pointer transition-all flex items-center justify-between text-xs font-heading uppercase ${
                    activeConvId === c.id
                      ? 'bg-comic-yellow text-ink border-ink shadow-[2px_2px_0px_#171510] font-bold'
                      : 'bg-cream text-ink border-transparent hover:border-ink/40'
                  }`}
                >
                  <span className="truncate pr-2">{c.title || 'Untitled Session'}</span>
                  <button
                    onClick={(e) => handleDeleteConversation(e, c.id)}
                    className="p-1 text-ink/60 hover:text-punch-red transition-colors"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Engine Status Badge */}
        <div className="pt-3 border-t-2 border-ink/20 text-[10px] font-mono text-ink/70 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-punch-red" />
          <span>GEMINI 1.5 RAG PIPELINE ACTIVE</span>
        </div>
      </div>

      {/* Main Chat Arena */}
      <div className="flex-1 comic-box bg-white flex flex-col justify-between overflow-hidden shadow-[6px_6px_0px_#171510] min-h-0">
        {/* Header Bar */}
        <div className="p-2.5 sm:p-3.5 border-b-[3px] border-ink bg-cream flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-punch-red text-cream flex items-center justify-center border-2 border-ink shadow-[2px_2px_0px_#171510] flex-shrink-0">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-sm sm:text-lg uppercase tracking-wide text-ink truncate">
                TOPPER AI COMPANION
              </h2>
              <div className="font-mono text-[9px] sm:text-[10px] text-olive-dark truncate flex items-center gap-1">
                <span>RAG:</span>
                <strong className="text-punch-red truncate">
                  {selectedDocObj ? selectedDocObj.title : 'All Question Banks'}
                </strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Mobile Toggle Button for Sessions & Docs */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen((prev) => !prev)}
              className="lg:hidden comic-btn comic-btn-yellow text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 font-comic flex items-center gap-1 shadow-[2px_2px_0px_#171510]"
            >
              <span>{mobileDrawerOpen ? '✕ CHAT' : `💬 SESSIONS (${conversations.length})`}</span>
            </button>

            {selectedDocObj && (
              <span className="hidden md:inline-flex font-comic text-[10px] bg-victory-green text-cream px-2 py-0.5 rounded border border-ink shadow-[1px_1px_0px_#171510] uppercase">
                TARGET LOCKED
              </span>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-cream/40">
          {messages.length === 0 ? (
            <div className="max-w-lg mx-auto py-8 text-center">
              <div className="w-14 h-14 bg-comic-yellow border-[3px] border-ink rounded-full flex items-center justify-center mx-auto mb-4 shadow-[3px_3px_0px_#171510] text-2xl">
                ⚡
              </div>
              <h3 className="font-heading text-2xl uppercase tracking-wider text-ink mb-1">
                ASK ANYTHING FROM YOUR SYLLABUS!
              </h3>
              <p className="font-sans text-xs text-olive-dark mb-6 font-medium">
                Topper AI retrieves verified pages from your question banks and explains answers in clear, exam-oriented steps.
              </p>

              <div className="space-y-2 text-left">
                <span className="font-comic text-xs uppercase text-ink/70">
                  TRY THESE PROMPTS:
                </span>
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(q)}
                    className="w-full text-left comic-box-sm p-2.5 bg-white text-xs font-sans font-semibold text-ink hover:bg-comic-yellow transition-colors flex items-center justify-between"
                  >
                    <span>{q}</span>
                    <Sparkles className="w-3.5 h-3.5 text-punch-red flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, index) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id || index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-2xl comic-box p-4 text-xs sm:text-sm font-sans leading-relaxed ${
                      isUser
                        ? 'bg-vintage-olive text-cream shadow-[4px_4px_0px_#171510]'
                        : 'bg-white text-ink shadow-[4px_4px_0px_#171510]'
                    }`}
                  >
                    {/* Header line for message */}
                    <div className="flex items-center justify-between gap-4 mb-2 pb-1 border-b border-current/20 text-[10px] font-mono">
                      <span className="font-bold uppercase tracking-wider">
                        {isUser ? 'YOU' : 'TOPPER AI'}
                      </span>
                      {!isUser && (
                        <button
                          onClick={() => copyToClipboard(m.content, m.id)}
                          className="hover:opacity-75 transition-opacity flex items-center gap-1"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3 h-3 text-victory-green" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedId === m.id ? 'COPIED' : 'COPY'}</span>
                        </button>
                      )}
                    </div>

                    <div className="whitespace-pre-wrap">
                      {m.content}
                      {m.isStreaming && (
                        <span className="inline-block w-2 h-3.5 ml-1 bg-punch-red animate-pulse align-middle" />
                      )}
                    </div>

                    {/* Source citations tags */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-ink/15 space-y-1">
                        <span className="font-comic text-[11px] uppercase text-punch-red font-bold block">
                          VERIFIED PDF CITATIONS:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {m.sources.map((s, idx) => (
                            <span
                              key={idx}
                              title={s.snippet}
                              className="font-mono text-[10px] bg-cream text-ink px-2 py-0.5 rounded border border-ink/50 flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3 text-punch-red" />
                              <span>
                                {s.document_name} • Page {s.page_number}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {sending && (!messages[messages.length - 1]?.content) && (
            <div className="flex flex-col items-start">
              <div className="comic-box p-3 bg-white text-ink font-comic text-xs uppercase animate-pulse flex items-center gap-2">
                <Bot className="w-4 h-4 text-punch-red animate-spin" />
                <span>RETRIEVING QUESTION BANK CHUNKS & PREPARING ANSWER...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-2 sm:p-3 bg-cream border-t-[3px] border-ink flex items-center gap-2"
        >
          <input
            type="text"
            placeholder={
              selectedDocObj
                ? `Ask about "${selectedDocObj.title}"...`
                : 'Ask any syllabus question...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending}
            className="comic-input text-xs sm:text-sm bg-white flex-1 min-w-0 py-2 sm:py-2.5"
          />

          <ComicButton
            type="submit"
            variant="yellow"
            size="md"
            disabled={sending || !inputText.trim()}
            icon={<Send className="w-4 h-4" />}
            className="flex-shrink-0 px-3 sm:px-4 py-2"
          >
            <span className="hidden sm:inline">SEND</span>
          </ComicButton>
        </form>
      </div>
    </div>
  );
};

export default AIChatbot;

