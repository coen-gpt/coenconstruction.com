import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, Send, ChevronDown, ChevronRight, Home, FileText,
  Camera, CheckCircle2, Clock, AlertCircle, Wrench, PartyPopper,
  Phone, Mail, MapPin
} from "lucide-react";

const STATUS_INFO = {
  walkthrough:    { label: "Walkthrough Completed", icon: CheckCircle2, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  draft:          { label: "Estimate Being Prepared", icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200" },
  pending_review: { label: "Awaiting Your Review", icon: FileText, color: "text-purple-600 bg-purple-50 border-purple-200" },
  approved:       { label: "Project Approved!", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
  modify:         { label: "Modification Requested", icon: AlertCircle, color: "text-orange-600 bg-orange-50 border-orange-200" },
  denied:         { label: "Estimate Not Approved", icon: AlertCircle, color: "text-red-600 bg-red-50 border-red-200" },
  in_progress:    { label: "Work In Progress!", icon: Wrench, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  completed:      { label: "Project Completed!", icon: PartyPopper, color: "text-green-700 bg-green-50 border-green-200" },
  cancelled:      { label: "Project Cancelled", icon: AlertCircle, color: "text-gray-600 bg-gray-50 border-gray-200" },
};

export default function CustomerPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [expandedEstimate, setExpandedEstimate] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!token) { setError("No portal link provided."); setLoading(false); return; }
    base44.functions.invoke("getCustomerPortal", { token })
      .then(res => {
        setData(res.data);
        setMessages(res.data?.portal?.chat_messages || []);
        setLoading(false);
      })
      .catch(err => { setError(err.message || "Failed to load portal."); setLoading(false); });
  }, [token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setMessages(prev => [...prev, { role: "customer", content: userMsg, created_at: new Date().toISOString() }]);
    setChatLoading(true);
    try {
      const res = await base44.functions.invoke("customerPortalAiChat", { token, message: userMsg });
      setMessages(prev => [...prev, { role: "assistant", content: res.data.reply, created_at: new Date().toISOString() }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble responding right now. Please try again in a moment.", created_at: new Date().toISOString() }]);
    }
    setChatLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading your project portal…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="font-bold text-secondary text-lg mb-2">Unable to Load Portal</h2>
        <p className="text-gray-500 text-sm">{error}</p>
        <p className="text-gray-400 text-sm mt-3">Please contact Coen Construction for a new link.</p>
      </div>
    </div>
  );

  const { project, estimates, portal } = data;
  const statusInfo = STATUS_INFO[project?.status] || STATUS_INFO.draft;
  const StatusIcon = statusInfo.icon;
  const originalEst = estimates?.find(e => e.type === "original" && e.status !== "superseded");
  const changeOrders = estimates?.filter(e => e.type === "change_order") || [];

  const tabs = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "estimate", label: "Estimate", icon: FileText },
    { id: "updates", label: "Updates", icon: CheckCircle2 },
    { id: "photos", label: "Photos", icon: Camera },
    { id: "chat", label: "Ask PM", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1B2B3A] text-white">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 mb-0.5 uppercase tracking-widest">Coen Construction</div>
              <h1 className="text-lg font-bold">Your Project Portal</h1>
              <p className="text-sm text-gray-300 mt-0.5">{project?.project_type} · {project?.client_address || project?.client_city}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#E35235]">
                ${(project?.adjusted_total || project?.original_estimate_total || 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">Project Value</div>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${statusInfo.color}`}>
            <StatusIcon className="w-4 h-4" />
            {statusInfo.label}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-2">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                    activeTab === tab.id
                      ? "border-[#E35235] text-[#E35235]"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-[#1B2B3A] mb-4">Project Details</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-700">{[project.client_address, project.client_city, project.client_zipcode].filter(Boolean).join(", ")}</span>
                </div>
                {project.scope_of_work && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Scope of Work</div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{project.scope_of_work}</p>
                  </div>
                )}
                {project.rooms?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Areas Included</div>
                    <div className="flex flex-wrap gap-2">
                      {project.rooms.map((r, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{r.name || r.type}</span>
                      ))}
                    </div>
                  </div>
                )}
                {project.client_signed && (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-2.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">Contract Signed {project.signed_date ? `on ${project.signed_date}` : ""}</span>
                  </div>
                )}
              </div>
            </div>

            {originalEst && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="font-semibold text-[#1B2B3A] mb-3">Estimate Summary</h2>
                <div className="flex justify-between items-center p-3 bg-[#1B2B3A] rounded-lg text-white">
                  <span className="font-semibold">Total Estimate</span>
                  <span className="text-xl font-bold text-[#E35235]">${(originalEst.grand_total || 0).toLocaleString()}</span>
                </div>
                <div className="mt-3 flex justify-between text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    originalEst.status === "approved" ? "bg-green-100 text-green-700" :
                    originalEst.status === "sent" ? "bg-purple-100 text-purple-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{originalEst.status}</span>
                  {originalEst.valid_until && <span className="text-gray-400 text-xs">Valid until {originalEst.valid_until}</span>}
                </div>
                <Button onClick={() => setActiveTab("estimate")} variant="outline" className="w-full mt-3 text-sm gap-1">
                  <FileText className="w-4 h-4" /> View Full Estimate
                </Button>
              </div>
            )}

            {/* Contact */}
            <div className="bg-[#1B2B3A] text-white rounded-xl p-5">
              <h2 className="font-semibold mb-3">Need Help?</h2>
              <div className="grid grid-cols-2 gap-3">
                <a href="tel:+17818001234" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg p-3 transition-colors">
                  <Phone className="w-4 h-4 text-[#E35235]" />
                  <div>
                    <div className="text-xs text-gray-400">Call Us</div>
                    <div className="text-sm font-semibold">(781) 800-1234</div>
                  </div>
                </a>
                <button onClick={() => setActiveTab("chat")} className="flex items-center gap-2 bg-[#E35235] hover:bg-[#c94522] rounded-lg p-3 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                  <div className="text-left">
                    <div className="text-xs text-white/70">Chat with</div>
                    <div className="text-sm font-semibold">Your PM</div>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ESTIMATE */}
        {activeTab === "estimate" && (
          <div className="space-y-4">
            {!originalEst && (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Your estimate is being prepared and will appear here soon.</p>
              </div>
            )}
            {originalEst && (
              <EstimateView estimate={originalEst} expanded={expandedEstimate === originalEst.id} onToggle={() => setExpandedEstimate(expandedEstimate === originalEst.id ? null : originalEst.id)} />
            )}
            {changeOrders.map(co => (
              <EstimateView key={co.id} estimate={co} isChangeOrder expanded={expandedEstimate === co.id} onToggle={() => setExpandedEstimate(expandedEstimate === co.id ? null : co.id)} />
            ))}
          </div>
        )}

        {/* UPDATES */}
        {activeTab === "updates" && (
          <div className="space-y-3">
            {(portal?.customer_notes || []).length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No updates posted yet. Check back soon!</p>
              </div>
            ) : (
              [...(portal.customer_notes || [])].reverse().map(note => (
                <div key={note.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1B2B3A] flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">PM</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">
                        {note.author} · {new Date(note.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed">{note.note}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PHOTOS */}
        {activeTab === "photos" && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-[#1B2B3A] mb-4">Site Photos ({project?.photos?.length || 0})</h2>
            {project?.photos?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {project.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden bg-gray-100 block">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No photos available yet.</p>
              </div>
            )}
          </div>
        )}

        {/* CHAT */}
        {activeTab === "chat" && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ height: "65vh" }}>
            <div className="bg-[#1B2B3A] px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#E35235] flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">Ask Your Project Manager</div>
                <div className="text-xs text-gray-300">AI-powered · always available</div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs text-green-300">Online</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500 font-medium">Hi {portal?.client_name?.split(" ")[0] || "there"}! 👋</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-[260px] mx-auto">Ask me anything about your project — status, timeline, estimate details, next steps, and more.</p>
                  <div className="mt-4 space-y-2">
                    {["What's the current status of my project?", "Can you explain the estimate?", "When does work start?"].map(q => (
                      <button key={q} onClick={() => setChatInput(q)} className="block w-full text-xs bg-gray-50 border border-gray-200 hover:border-[#E35235] hover:bg-[#E35235]/5 text-gray-600 rounded-lg px-3 py-2 text-left transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-[#1B2B3A] flex items-center justify-center shrink-0 mr-2 mt-1">
                      <span className="text-white text-xs font-bold">PM</span>
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === "customer"
                      ? "bg-[#E35235] text-white rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-tl-sm"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-[#1B2B3A] flex items-center justify-center shrink-0 mr-2">
                    <span className="text-white text-xs font-bold">PM</span>
                  </div>
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-gray-200 p-3 flex gap-2">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask about your project..."
                className="text-sm flex-1"
                disabled={chatLoading}
              />
              <Button onClick={sendMessage} disabled={chatLoading || !chatInput.trim()} className="bg-[#E35235] text-white shrink-0" size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EstimateView({ estimate, isChangeOrder, expanded, onToggle }) {
  const groups = (estimate.line_items || []).reduce((acc, item) => {
    const g = item.parent_group || "General";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
        <div className="text-left">
          <div className="font-semibold text-[#1B2B3A] text-sm">
            {isChangeOrder ? `Change Order #${estimate.change_order_number}` : "Project Estimate"}
          </div>
          {estimate.scope_change_description && (
            <div className="text-xs text-gray-500 mt-0.5">{estimate.scope_change_description}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#E35235]">${(estimate.grand_total || 0).toLocaleString()}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            estimate.status === "approved" ? "bg-green-100 text-green-700" :
            estimate.status === "sent" ? "bg-purple-100 text-purple-700" :
            "bg-gray-100 text-gray-600"
          }`}>{estimate.status}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
                <span className="text-xs font-semibold text-[#1B2B3A] uppercase tracking-wide">{group}</span>
                <span className="text-xs font-semibold text-[#E35235]">
                  ${items.reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}
                </span>
              </div>
              {items.map(item => (
                <div key={item.id} className="px-4 py-2.5 flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1B2B3A]">{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {item.description.replace(/\*\*/g, '').replace(/\*/g, '')}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">{item.quantity} {item.unit}</div>
                  </div>
                  <span className="text-sm font-semibold text-[#1B2B3A] shrink-0">${(item.total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-3 bg-[#1B2B3A]">
            <span className="text-white font-bold">Total</span>
            <span className="text-xl font-bold text-[#E35235]">${(estimate.grand_total || 0).toLocaleString()}</span>
          </div>
          {estimate.notes && (
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes & Terms</div>
              <p className="text-sm text-gray-600 leading-relaxed">{estimate.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}