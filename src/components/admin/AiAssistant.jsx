import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bot, X, Send, Minimize2, Maximize2, RefreshCw, Database, Zap, Settings, Mail, Calendar } from "lucide-react";

const QUICK_PROMPTS = {
  admin: ["Summarize today's leads", "Any outstanding invoices?", "What blog posts need attention?", "Show project pipeline"],
  estimator: ["Summarize recent projects", "Which projects need estimates?", "Help me write a scope of work", "Show active leads"],
  viewer: ["What can I help with today?", "Show recent activity", "Help me draft a note", "Summarize the pipeline"],
};

export default function AiAssistant({ adminUser }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [checkingConnections, setCheckingConnections] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showChatList, setShowChatList] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const GMAIL_CONNECTOR_ID = '69d7f13365faab80a1faef3b'; // Staff AI Gmail
  const CALENDAR_CONNECTOR_ID = '69d7f137c2264bb13d8db588'; // Staff AI Calendar

  const checkConnections = async () => {
    setCheckingConnections(true);
    try {
      const gmailTest = await base44.connectors
        .getCurrentAppUserAccessToken(GMAIL_CONNECTOR_ID)
        .then(() => true)
        .catch(() => false);
      const calTest = await base44.connectors
        .getCurrentAppUserAccessToken(CALENDAR_CONNECTOR_ID)
        .then(() => true)
        .catch(() => false);
      setGmailConnected(gmailTest);
      setCalendarConnected(calTest);
    } catch (err) {
      console.error('Connection check error:', err);
      setGmailConnected(false);
      setCalendarConnected(false);
    } finally {
      setCheckingConnections(false);
    }
  };

  useEffect(() => {
    if (open) checkConnections();
  }, [open]);

  useEffect(() => {
    if (open && adminUser?.email) {
      base44.entities.AiChat.filter({ user_email: adminUser.email, is_archived: false }, '-created_date', 20)
        .then(setChatHistory)
        .catch(() => {});
    }
  }, [open, adminUser?.email]);

  useEffect(() => {
    if (open && !minimized && messages.length === 0 && !currentChatId) {
      setMessages([{
        role: "assistant",
        content: `Hi ${(adminUser?.full_name || adminUser?.name)?.split(' ')[0] || 'there'}! 👋 I'm your AI assistant. I know your role and have access to live data. Ask me anything — leads, projects, invoices, content — or pick a quick action below.`,
      }]);
    }
  }, [open, minimized, currentChatId]);

  const loadChat = (chatId) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      setMessages(chat.messages || []);
      setCurrentChatId(chatId);
      setShowChatList(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setShowChatList(false);
  };

  const saveChat = async () => {
    if (messages.length === 0) return;
    const title = messages[0]?.content?.slice(0, 50) || `Chat ${new Date().toLocaleDateString()}`;
    if (currentChatId) {
      await base44.entities.AiChat.update(currentChatId, { messages, title });
    } else {
      const chat = await base44.entities.AiChat.create({
        user_email: adminUser.email,
        title,
        messages,
      });
      setCurrentChatId(chat.id);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = async (text) => {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await base44.functions.invoke("adminAiAssistant", {
        messages: newMessages,
        includeContext: useContext,
        gmailConnected,
        calendarConnected,
        adminUserEmail: adminUser?.email,
      });

      const toolsUsed = res.data?.tools_used || [];
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.data?.reply || "Sorry, I couldn't process that.",
        tools_used: toolsUsed,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: Unable to reach AI assistant. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = QUICK_PROMPTS[adminUser?.role] || QUICK_PROMPTS.viewer;

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMinimized(false); }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-secondary text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-secondary/90 transition-all hover:scale-110 group"
        title="AI Assistant"
      >
        <Bot className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-secondary text-white rounded-2xl shadow-2xl border border-gray-300 p-3 cursor-pointer hover:shadow-lg transition-all" onClick={() => setMinimized(false)}>
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4" />
          <span className="text-xs font-medium">AI Assistant</span>
          <span className="text-[10px] bg-primary/30 px-1.5 py-0.5 rounded">{messages.length} msg</span>
        </div>
      </div>
    );
  }

  const width = expanded ? "w-[700px]" : "w-[380px]";
  const height = expanded ? "h-[80vh]" : "h-[520px]";

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${width} ${height} bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-200`}>
      {/* Header */}
      <div className="bg-secondary px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm leading-tight">AI Assistant</div>
          <div className="text-white/50 text-xs capitalize">{adminUser?.role} · {adminUser?.full_name || adminUser?.name}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setUseContext(c => !c); }}
            title={useContext ? "Live data ON — click to disable" : "Live data OFF — click to enable"}
            className={`p-1.5 rounded transition-colors ${useContext ? 'text-green-400 hover:text-green-300' : 'text-white/30 hover:text-white/60'}`}
          >
            <Database className="w-4 h-4" />
          </button>
          <button
            onClick={() => { saveChat(); setShowChatList(!showChatList); }}
            title="Chat history"
            className="text-white/60 hover:text-white p-1.5 rounded transition-colors text-xs font-medium"
          >
            📋
          </button>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            title="Integrations"
            className="text-white/60 hover:text-white p-1.5 rounded transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="text-white/60 hover:text-white p-1.5 rounded transition-colors">
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setMinimized(true)} className="text-white/60 hover:text-white p-1.5 rounded transition-colors" title="Minimize">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
          </button>
          <button onClick={() => { setOpen(false); saveChat(); }} className="text-white/60 hover:text-white p-1.5 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat List */}
      {showChatList && (
        <div className="border-b border-gray-200 bg-gray-50 p-3 max-h-64 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Chat History</div>
            <button onClick={newChat} className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90">New Chat</button>
          </div>
          {chatHistory.length === 0 ? (
            <p className="text-xs text-gray-500">No chats yet</p>
          ) : (
            chatHistory.map(chat => (
              <div key={chat.id} className="bg-white rounded p-2 border border-gray-100 text-xs cursor-pointer hover:bg-gray-50" onClick={() => loadChat(chat.id)}>
                <div className="font-medium text-gray-700 truncate">{chat.title}</div>
                <div className="text-gray-400">{(chat.messages || []).length} messages</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Settings Panel */}
      {settingsOpen && (
        <div className="border-b border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Integrations</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" style={{ color: gmailConnected ? '#22c55e' : '#ef4444' }} />
                <div>
                  <div className="text-xs font-medium text-gray-700">Gmail</div>
                  <div className={`text-[10px] ${gmailConnected ? 'text-green-600' : 'text-gray-500'}`}>{gmailConnected ? '✓ Connected' : 'Not connected'}</div>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (gmailConnected) {
                    await base44.connectors.disconnectAppUser(GMAIL_CONNECTOR_ID);
                    setGmailConnected(false);
                  } else {
                    const url = await base44.connectors.connectAppUser(GMAIL_CONNECTOR_ID);
                    const p = window.open(url);
                    const t = setInterval(() => { if (!p || p.closed) { clearInterval(t); checkConnections(); } }, 500);
                  }
                }}
                disabled={checkingConnections}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  gmailConnected
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                    : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                }`}
              >
                {gmailConnected ? <>Disconnect</> : <>Connect</>}
              </button>
            </div>
            <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: calendarConnected ? '#22c55e' : '#ef4444' }} />
                <div>
                  <div className="text-xs font-medium text-gray-700">Calendar</div>
                  <div className={`text-[10px] ${calendarConnected ? 'text-green-600' : 'text-gray-500'}`}>{calendarConnected ? '✓ Connected' : 'Not connected'}</div>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (calendarConnected) {
                    await base44.connectors.disconnectAppUser(CALENDAR_CONNECTOR_ID);
                    setCalendarConnected(false);
                  } else {
                    const url = await base44.connectors.connectAppUser(CALENDAR_CONNECTOR_ID);
                    const p = window.open(url);
                    const t = setInterval(() => { if (!p || p.closed) { clearInterval(t); checkConnections(); } }, 500);
                  }
                }}
                disabled={checkingConnections}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  calendarConnected
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                    : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                }`}
              >
                {calendarConnected ? <>Disconnect</> : <>Connect</>}
              </button>
              </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className="max-w-[85%] flex flex-col gap-1">
              {m.tools_used?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.tools_used.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">
                      <Zap className="w-2.5 h-2.5" />{t.replace('get_', '')}
                    </span>
                  ))}
                </div>
              )}
              <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap
                ${m.role === "user"
                  ? "bg-primary text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                {m.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center mr-2 mt-0.5 shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-gray-100 px-4 py-2.5 rounded-xl rounded-bl-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Quick prompts after first message */}
        {messages.length === 1 && !loading && (
          <div className="flex flex-wrap gap-2 pt-1">
            {quickPrompts.map(p => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-xs bg-secondary/5 border border-secondary/15 text-secondary px-3 py-1.5 rounded-full hover:bg-secondary/10 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Ask anything…"
          rows={1}
          className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-secondary transition-colors max-h-24 overflow-y-auto"
          style={{ minHeight: '36px' }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}