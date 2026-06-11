import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, Send, ChevronDown, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Wrench, PartyPopper,
  Phone, FileText, Camera, Bell, HardHat, Star, PenLine, DollarSign,
  Image, ExternalLink, ClipboardList
} from "lucide-react";
import ContractSignModal from "@/components/estimator/ContractSignModal";
import DepositPaymentSection from "@/components/portal/DepositPaymentSection";
import SignatureModal from "@/components/estimator/SignatureModal";
import ProjectTimeline from "@/components/portal/ProjectTimeline";
import VirtualSiteWalk from "@/components/estimator/VirtualSiteWalk";
import PortalFiles from "@/components/portal/PortalFiles";
import PunchlistSection from "@/components/portal/PunchlistSection";
import BrandLogo from "@/components/shared/BrandLogo";

const STATUS_INFO = {
  walkthrough:    { label: "We visited your home!", desc: "Your walkthrough is complete. We're working on your estimate.", icon: CheckCircle2, bg: "bg-amber-500" },
  draft:          { label: "Your estimate is on the way", desc: "Our team is preparing a detailed estimate for your project.", icon: Clock, bg: "bg-blue-500" },
  sent:           { label: "Your estimate is ready!", desc: "Please review your estimate below. Questions? Just ask!", icon: FileText, bg: "bg-sky-500" },
  pending_review: { label: "Your estimate is almost ready", desc: "We're putting the final touches on your estimate — you'll have it shortly.", icon: Clock, bg: "bg-purple-500" },
  approved:       { label: "Project approved — let's build!", desc: "Your project is confirmed. We'll be in touch to schedule start dates.", icon: CheckCircle2, bg: "bg-green-500" },
  modify:         { label: "We're updating your estimate", desc: "Changes were requested and our team is working on revisions.", icon: AlertCircle, bg: "bg-orange-500" },
  denied:         { label: "Estimate not approved", desc: "Please contact us if you'd like to discuss alternatives.", icon: AlertCircle, bg: "bg-red-500" },
  in_progress:    { label: "Work is underway! 🏗️", desc: "Your project is actively being built. Check updates below.", icon: Wrench, bg: "bg-indigo-500" },
  completed:      { label: "Project complete! 🎉", desc: "Thank you for trusting Coen Construction. We hope you love it!", icon: PartyPopper, bg: "bg-green-600" },
  cancelled:      { label: "Project cancelled", desc: "Please contact us if you have any questions.", icon: AlertCircle, bg: "bg-gray-400" },
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
  const [showContractModal, setShowContractModal] = useState(false);
  const [depositPaid, setDepositPaid] = useState(false);
  const [punchlist, setPunchlist] = useState(null);
  const chatEndRef = useRef(null);

  // Re-fetch portal data without the initial loading screen (used after the
  // customer signs the contract or approves a change order).
  const refreshPortal = () => {
    if (!token) return Promise.resolve();
    return base44.functions.invoke("getCustomerPortal", { token })
      .then(res => {
        setData(res.data);
        setDepositPaid(res.data?.project?.deposit_paid || false);
        setPunchlist(res.data?.punchlist || null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!token) { setError("no_token"); setLoading(false); return; }
    base44.functions.invoke("getCustomerPortal", { token })
      .then(res => {
        if (!res.data?.project) { setError("invalid"); setLoading(false); return; }
        setData(res.data);
        setMessages(res.data?.portal?.chat_messages || []);
        setDepositPaid(res.data?.project?.deposit_paid || false);
        setPunchlist(res.data?.punchlist || null);
        // Auto-expand the first estimate
        const est = res.data?.estimates?.find(e => e.type === "original" && e.status !== "superseded");
        if (est) setExpandedEstimate(est.id);
        setLoading(false);
      })
      .catch(() => { setError("invalid"); setLoading(false); });
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
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble right now. Please call us at (617) 857-COEN and we'll be happy to help!", created_at: new Date().toISOString() }]);
    }
    setChatLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
        <HardHat className="w-6 h-6 text-white" />
      </div>
      <p className="text-gray-500 font-medium">Loading your project…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full">
        <div className="flex justify-center mb-6">
          <BrandLogo className="h-10" />
        </div>
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Link Not Found</h2>
        <p className="text-gray-500 mb-6">
          {error === "no_token"
            ? "No project link was provided. Please use the link from your email."
            : "This link may have expired or is invalid. Please contact us for a new one."}
        </p>
        <a href="tel:6178572636" className="flex items-center justify-center gap-2 bg-primary text-white font-semibold rounded-xl py-3 px-6 hover:bg-[#c94522] transition-colors">
          <Phone className="w-4 h-4" /> Call Us: (617) 857-COEN
        </a>
      </div>
    </div>
  );

  const { project, estimates, portal, company, materials = [], allowances = [], payment_schedule: paymentSchedule } = data;
  const statusInfo = STATUS_INFO[project?.status] || STATUS_INFO.draft;
  const StatusIcon = statusInfo.icon;
  const originalEst = estimates?.find(e => e.type === "original" && e.status !== "superseded");
  const changeOrders = estimates?.filter(e => e.type === "change_order") || [];
  const firstName = portal?.client_name?.split(" ")[0] || project?.client_name?.split(" ")[0] || "there";
  const projectValue = project?.adjusted_total || project?.original_estimate_total;
  const updates = portal?.customer_notes || [];
  const photos = project?.photos || [];
  const photos360 = project?.photos_360 || [];
  const needsContractSign = originalEst && !project?.client_signed;
  const needsDeposit = project?.client_signed && !depositPaid && !project?.deposit_paid;
  const portalActive = project?.deposit_paid || depositPaid || project?.portal_access_granted;

  const designs = project?.ai_designs || [];
  const documents = project?.documents_meta || [];
  const hasDesignFiles = designs.length > 0 || documents.length > 0;

  const pendingCOs = changeOrders.filter(co => co.status === "sent");
  const showPunchlist = punchlist && punchlist.status !== "not_sent";
  const punchlistDone = punchlist?.status === "submitted" || punchlist?.status === "reviewed";

  // One source of truth for the deposit due — same percentage rule the
  // contract modal and backend use (company deposit %, default 33).
  const depositDue = project?.deposit_amount
    || Math.round((originalEst?.grand_total || 0) * (company?.deposit_percentage || 33) / 100);

  // Direct "write a review" link — only shown when the real Place ID is configured
  const reviewUrl = company?.google_place_id
    ? `https://search.google.com/local/writereview?placeid=${company.google_place_id}`
    : null;

  // badge = small count chip; alert = pulsing attention dot; done = checkmark
  const tabs = [
    { id: "overview", label: "My Project" },
    ...(originalEst ? [{ id: "estimate", label: "Estimate" }] : []),
    ...(changeOrders.length > 0 ? [{ id: "changes", label: "Changes", badge: pendingCOs.length, alert: pendingCOs.length > 0 }] : []),
    ...(needsDeposit ? [{ id: "deposit", label: "Deposit", alert: true }] : []),
    ...(paymentSchedule?.length > 0 ? [{ id: "payments", label: "Payments" }] : []),
    ...(materials.length > 0 || allowances.length > 0 ? [{ id: "materials", label: "Materials" }] : []),
    { id: "timeline", label: "Schedule" },
    { id: "files", label: "Files" },
    ...(hasDesignFiles ? [{ id: "designs", label: "Designs" }] : []),
    ...(updates.length > 0 ? [{ id: "updates", label: "Updates", badge: updates.length }] : []),
    ...(photos.length > 0 ? [{ id: "photos", label: "Photos" }] : []),
    ...(photos360.length > 0 ? [{ id: "360walk", label: "Site Walk" }] : []),
    ...(showPunchlist ? [{ id: "punchlist", label: "Punchlist", alert: punchlist?.status === "sent", done: punchlistDone }] : []),
    { id: "chat", label: "Ask PM" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Hero Header */}
      <div className="bg-secondary">
        <div className="max-w-xl mx-auto px-5 pt-8 pb-6">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2 mb-6">
            <BrandLogo onDark className="h-9" />
          </div>

          {/* Greeting */}
          <h1 className="text-white text-2xl font-bold leading-snug">
            Hi {firstName}! 👋<br />
            <span className="text-gray-300 font-normal text-lg">Here's your project update.</span>
          </h1>

          {/* Action Banners */}
          {needsContractSign && (
            <div className="mt-4 bg-amber-400 rounded-2xl p-4 flex items-center gap-3">
              <PenLine className="w-6 h-6 text-amber-900 shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-amber-900 text-sm">Action Required: Sign Your Contract</div>
                <div className="text-amber-800 text-xs mt-0.5">Review and e-sign your contract to proceed</div>
              </div>
              <Button onClick={() => setShowContractModal(true)} className="bg-amber-900 hover:bg-amber-950 text-white text-xs shrink-0 h-8 px-3">
                Sign Now
              </Button>
            </div>
          )}
          {pendingCOs.length > 0 && (
            <div className="mt-4 bg-orange-400 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-orange-900 shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-orange-900 text-sm">Action Required: Sign Change Order{pendingCOs.length > 1 ? "s" : ""}</div>
                <div className="text-orange-800 text-xs mt-0.5">{pendingCOs.length} change order{pendingCOs.length > 1 ? "s" : ""} need{pendingCOs.length === 1 ? "s" : ""} your signature to proceed</div>
              </div>
              <Button onClick={() => setActiveTab("changes")} className="bg-orange-900 hover:bg-orange-950 text-white text-xs shrink-0 h-8 px-3">
                Review
              </Button>
            </div>
          )}
          {showPunchlist && punchlist?.status === "sent" && (
            <div className="mt-4 bg-purple-500 rounded-2xl p-4 flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-purple-100 shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-white text-sm">Action Required: Submit Your Punchlist</div>
                <div className="text-purple-100 text-xs mt-0.5">Your project is substantially complete — please submit your final punchlist</div>
              </div>
              <Button onClick={() => setActiveTab("punchlist")} className="bg-white text-purple-700 font-bold text-xs shrink-0 h-8 px-3 hover:bg-purple-50">
                Submit Now
              </Button>
            </div>
          )}
          {needsDeposit && (
            <div className="mt-4 bg-green-400 rounded-2xl p-4 flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-green-900 shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-green-900 text-sm">Action Required: Pay Your Deposit</div>
                <div className="text-green-800 text-xs mt-0.5">
                  {depositDue > 0 ? `Deposit of $${depositDue.toLocaleString()} activates your project` : "Your deposit activates your project"}
                </div>
              </div>
              <Button onClick={() => setActiveTab("deposit")} className="bg-green-900 hover:bg-green-950 text-white text-xs shrink-0 h-8 px-3">
                Pay Now
              </Button>
            </div>
          )}

          {/* Status Card */}
          <div className={`mt-5 ${statusInfo.bg} rounded-2xl p-4 flex items-start gap-3`}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <StatusIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-base leading-tight">{statusInfo.label}</div>
              <div className="text-white/80 text-sm mt-0.5">{statusInfo.desc}</div>
            </div>
          </div>

          {/* Project Value */}
          {projectValue > 0 && (
            <div className="mt-4 flex items-center justify-between bg-white/10 rounded-xl px-4 py-3">
              <span className="text-gray-300 text-sm">Project Value</span>
              <span className="text-white font-bold text-xl">${projectValue.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Nav */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 py-1.5 scrollbar-hide">
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center px-4 py-2.5 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors shrink-0 ${
                    active
                      ? "bg-primary text-white"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                  {tab.badge > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] ${
                      active ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                  {tab.alert && !tab.badge && (
                    <span className={`ml-1.5 inline-block w-2 h-2 rounded-full ${active ? "bg-white" : "bg-amber-400 animate-pulse"}`} />
                  )}
                  {tab.done && (
                    <CheckCircle2 className={`ml-1.5 w-3.5 h-3.5 ${active ? "text-white" : "text-green-500"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <>
            {/* Project Address */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-800 text-base mb-3">Your Project</h2>
              <div className="space-y-2 text-sm text-gray-600">
                {project.project_type && (
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-gray-800">{project.project_type}</span>
                  </div>
                )}
                {(project.client_address || project.client_city) && (
                  <div className="text-gray-500">
                    📍 {[project.client_address, project.client_city, project.client_zipcode].filter(Boolean).join(", ")}
                  </div>
                )}
                {project.scope_of_work && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">What's Included</div>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">{project.scope_of_work}</p>
                  </div>
                )}
                {project.rooms?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Areas</div>
                    <div className="flex flex-wrap gap-2">
                      {project.rooms.map((r, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-gray-700 px-3 py-1 rounded-full font-medium">{r.name || r.type}</span>
                      ))}
                    </div>
                  </div>
                )}
                {project.client_signed && (
                  <div className="mt-3 flex items-center gap-2 bg-green-50 text-green-700 rounded-xl px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="font-semibold text-sm">Contract signed{project.signed_date ? ` on ${parseLocalDate(project.signed_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Latest Update */}
            {updates.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-amber-800 text-sm">Latest Update from Your PM</span>
                </div>
                <p className="text-amber-900 text-sm leading-relaxed">{updates[updates.length - 1].note}</p>
                <p className="text-amber-600 text-xs mt-2">
                  {new Date(updates[updates.length - 1].created_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                </p>
                {updates.length > 1 && (
                  <button onClick={() => setActiveTab("updates")} className="text-amber-700 text-xs font-semibold mt-2 hover:underline">
                    View all {updates.length} updates →
                  </button>
                )}
              </div>
            )}

            {/* Estimate Teaser */}
            {originalEst && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-800 text-base">Your Estimate</h2>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    originalEst.status === "approved" ? "bg-green-100 text-green-700" :
                    originalEst.status === "sent" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {originalEst.status === "sent" ? "Ready for review" : originalEst.status === "approved" ? "✓ Approved" : originalEst.status}
                  </span>
                </div>
                <div className="bg-secondary rounded-xl flex items-center justify-between px-4 py-3 mb-3">
                  <span className="text-gray-300 text-sm">Total</span>
                  <span className="text-white font-bold text-2xl">${(originalEst.grand_total || 0).toLocaleString()}</span>
                </div>
                <Button onClick={() => setActiveTab("estimate")} className="w-full bg-primary text-white font-semibold rounded-xl">
                  View Full Estimate
                </Button>
              </div>
            )}

            {/* Contact Card */}
            <div className="bg-secondary rounded-2xl p-5">
              <h2 className="text-white font-bold text-base mb-1">Questions? We're here.</h2>
              <p className="text-gray-400 text-sm mb-4">Our team is available Mon–Fri, 7am–5pm</p>
              <div className="space-y-2">
                <a
                  href="tel:6178572636"
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 transition-colors"
                >
                  <Phone className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <div className="text-white font-semibold text-sm">Call Us</div>
                    <div className="text-gray-400 text-xs">(617) 857-COEN</div>
                  </div>
                </a>
                <button
                  onClick={() => setActiveTab("chat")}
                  className="w-full flex items-center gap-3 bg-primary hover:bg-[#c94522] rounded-xl px-4 py-3 transition-colors"
                >
                  <MessageSquare className="w-5 h-5 text-white shrink-0" />
                  <div className="text-left">
                    <div className="text-white font-semibold text-sm">Ask Your Project Manager</div>
                    <div className="text-white/70 text-xs">AI assistant, available 24/7</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Review prompt (for completed projects) — only with a real review link */}
            {project.status === "completed" && reviewUrl && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-center">
                <Star className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <h3 className="font-bold text-gray-800 mb-1">Enjoying your renovation?</h3>
                <p className="text-gray-500 text-sm mb-3">A quick Google review means the world to our small business.</p>
                <a
                  href={reviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
                >
                  <Star className="w-4 h-4" /> Leave a Review
                </a>
              </div>
            )}
          </>
        )}

        {/* ── ESTIMATE ── */}
        {activeTab === "estimate" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-800 text-base mb-1">Your Project Estimate</h2>
              <p className="text-gray-500 text-sm">Tap any section below to see a full breakdown.</p>
            </div>
            {!originalEst && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Your estimate is being prepared.</p>
                <p className="text-gray-400 text-sm mt-1">We'll email you as soon as it's ready!</p>
              </div>
            )}
            {originalEst && (
              <EstimateView
                estimate={originalEst}
                isChangeOrder={false}
                expanded={expandedEstimate === originalEst.id}
                onToggle={() => setExpandedEstimate(expandedEstimate === originalEst.id ? null : originalEst.id)}
                token={token}
                project={project}
                onApproved={refreshPortal}
              />
            )}
            {changeOrders.map(co => (
              <EstimateView
                key={co.id}
                estimate={co}
                isChangeOrder
                expanded={expandedEstimate === co.id}
                onToggle={() => setExpandedEstimate(expandedEstimate === co.id ? null : co.id)}
                token={token}
                project={project}
                onApproved={refreshPortal}
              />
            ))}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
              <p className="text-blue-700 text-sm font-medium">Have questions about a line item?</p>
              <button onClick={() => setActiveTab("chat")} className="text-blue-600 text-sm font-bold hover:underline mt-1">
                Ask your project manager →
              </button>
            </div>
          </div>
        )}

        {/* ── CHANGE ORDERS ── */}
        {activeTab === "changes" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-800 text-base mb-1">Change Orders</h2>
              <p className="text-gray-500 text-sm">Scope adjustments or budget changes that require your approval.</p>
            </div>
            {pendingCOs.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold text-amber-800 text-sm">{pendingCOs.length} change order{pendingCOs.length > 1 ? "s" : ""} awaiting your approval</p>
                  <p className="text-amber-700 text-xs mt-0.5">Review and e-sign each one below to authorize work to continue.</p>
                </div>
              </div>
            )}
            {changeOrders.map(co => (
              <EstimateView
                key={co.id}
                estimate={co}
                isChangeOrder
                expanded={expandedEstimate === co.id}
                onToggle={() => setExpandedEstimate(expandedEstimate === co.id ? null : co.id)}
                token={token}
                project={project}
                onApproved={refreshPortal}
              />
            ))}
          </div>
        )}

        {/* ── MATERIALS & ALLOWANCES ── */}
        {activeTab === "materials" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-800 text-base mb-1">Materials & Allowances</h2>
              <p className="text-gray-500 text-sm">Materials and supplies purchased for your project, and how your allowance budgets are tracking.</p>
            </div>

            {/* Allowance budgets */}
            {allowances.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="font-bold text-gray-800 text-sm">Your Allowances</h3>
                {allowances.map(a => {
                  const pct = a.amount > 0 ? Math.min(100, Math.round((a.used / a.amount) * 100)) : 0;
                  const over = a.used > (a.amount || 0);
                  return (
                    <div key={a.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-800">{a.name}</span>
                        <span className={`font-semibold ${over ? "text-red-600" : "text-gray-700"}`}>
                          ${a.used.toLocaleString()} <span className="text-gray-400 font-normal">of ${Number(a.amount || 0).toLocaleString()}</span>
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct > 85 ? "bg-amber-400" : "bg-green-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className={`text-xs mt-1 ${over ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                        {over
                          ? `$${(a.used - a.amount).toLocaleString()} over allowance`
                          : `$${a.remaining.toLocaleString()} remaining`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Purchased materials list */}
            {materials.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">Purchases for Your Project</h3>
                  <span className="font-bold text-gray-900 text-sm">
                    ${materials.reduce((s, m) => s + (m.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {materials.map(m => (
                    <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 text-sm truncate">{m.title}</div>
                        <div className="text-xs text-gray-400">
                          {[m.vendor, m.date ? new Date(m.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <span className="font-semibold text-gray-800 text-sm shrink-0">${Number(m.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {materials.length === 0 && allowances.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No materials posted yet</p>
              </div>
            )}
          </div>
        )}

        {/* ── UPDATES ── */}
        {activeTab === "updates" && (
          <div className="space-y-3">
            {updates.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No updates yet — check back soon!</p>
                <p className="text-gray-400 text-sm mt-1">We'll email you whenever there's news about your project.</p>
              </div>
            ) : (
              [...updates].reverse().map((note, i) => (
                <div key={note.id || i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <HardHat className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800 text-sm">Coen Construction</span>
                        <span className="text-gray-400 text-xs">
                          {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">{note.note}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── PHOTOS ── */}
        {activeTab === "photos" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 text-base mb-4">Project Photos</h2>
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden bg-gray-100 block">
                    <img src={url} alt={`Photo ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No photos uploaded yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ── VIRTUAL SITE WALK ── */}
        {activeTab === "360walk" && (
          <VirtualSiteWalk project={project} readOnly onUpdate={() => { /* No-op for client view */ }} />
        )}

        {/* ── TIMELINE ── */}
        {activeTab === "timeline" && (
          <ProjectTimeline project={project} token={token} />
        )}

        {/* ── FILES ── */}
        {activeTab === "files" && (
          <PortalFiles project={project} estimates={estimates} portal={portal} token={token} />
        )}

        {/* ── DESIGNS ── */}
        {activeTab === "designs" && (
          <DesignFiles project={project} />
        )}

        {/* ── PUNCHLIST ── */}
        {activeTab === "punchlist" && (
          <PunchlistSection
            project={project}
            punchlist={punchlist}
            token={token}
            onUpdate={() => {
              // Re-fetch portal data to get updated punchlist
              base44.functions.invoke("getCustomerPortal", { token })
                .then(res => setPunchlist(res.data?.punchlist || null));
            }}
          />
        )}

        {/* ── PAYMENT SCHEDULE ── */}
        {activeTab === "payments" && (
          <PaymentScheduleView milestones={paymentSchedule || []} />
        )}

        {/* ── DEPOSIT ── */}
        {activeTab === "deposit" && (
          <DepositPaymentSection
            project={project}
            depositAmount={depositDue}
            token={token}
            onPaid={() => { setDepositPaid(true); setActiveTab("overview"); }}
          />
        )}

        {/* ── CHAT ── */}
        {activeTab === "chat" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col portal-chat-height">
            {/* Chat Header */}
            <div className="bg-secondary px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                <HardHat className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-white font-bold">Your Project Manager</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-green-300 text-xs">Always available</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.length === 0 && (
                <div className="py-4">
                  {/* Welcome message */}
                  <div className="flex justify-start mb-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mr-2 mt-1">
                      <HardHat className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%]">
                      <p className="text-gray-800 text-sm leading-relaxed">
                        Hi {firstName}! 👋 I'm <strong>Ask PM</strong> — your AI project manager for Coen Construction. I have full details on your project and can answer questions about your estimate, timeline, scope, and more, anytime 24/7. If I can't answer something, I'll flag it for your project manager to follow up. What would you like to know?
                      </p>
                    </div>
                  </div>
                  {/* Quick questions */}
                  <div className="pl-10 space-y-2">
                    {[
                      "What's the status of my project?",
                      "Can you walk me through my estimate?",
                      "When does work start?",
                      "How do I approve the estimate?",
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => setChatInput(q)}
                        className="block w-full text-left text-sm bg-white border border-gray-200 hover:border-primary hover:bg-primary/5 text-gray-600 rounded-xl px-4 py-2.5 transition-colors shadow-sm"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mr-2 mt-1">
                      <HardHat className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    m.role === "customer"
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-white text-gray-800 rounded-tl-sm"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mr-2">
                    <HardHat className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white px-4 py-3.5 rounded-2xl rounded-tl-sm shadow-sm">
                    <div className="flex gap-1.5">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-3 bg-white flex gap-2">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Type your question…"
                className="text-sm flex-1 rounded-xl border-gray-200"
                disabled={chatLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-primary hover:bg-[#c94522] text-white shrink-0 rounded-xl"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-xl mx-auto px-4 pt-2 text-center">
        <p className="text-xs text-gray-400">
          Powered by <span className="font-semibold text-gray-500">Coen Construction</span> · (617) 857-COEN
        </p>
      </div>

      {/* Floating "Ask Your PM" chat button — reachable from every tab */}
      {activeTab !== "chat" && (
        <button
          type="button"
          onClick={() => { setActiveTab("chat"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          aria-label="Ask your Project Manager"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-primary hover:bg-[#c94522] text-white font-bold rounded-full pl-4 pr-5 py-3.5 shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-95"
        >
          <span className="relative flex">
            <MessageSquare className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 border-2 border-primary rounded-full" />
          </span>
          <span className="text-sm">Ask Your PM</span>
        </button>
      )}

      {/* Contract Sign Modal */}
      <ContractSignModal
        project={project}
        estimate={originalEst}
        company={company}
        paymentSchedule={paymentSchedule}
        token={token}
        open={showContractModal}
        onClose={() => setShowContractModal(false)}
        onSigned={() => {
          // Wait for fresh data (deposit_amount is set server-side on signing)
          // so the deposit tab opens with the real number, not the fallback.
          refreshPortal().finally(() => setActiveTab("deposit"));
        }}
      />
    </div>
  );
}

// ── Design Files / Renders ───────────────────────────────────────────────────
function DesignFiles({ project }) {
  const designs = project?.ai_designs || [];
  const documents = (project?.documents_meta || []).filter(d =>
    ["jpg","jpeg","png","gif","webp","pdf"].some(ext => d.url?.toLowerCase().includes(ext) || d.name?.toLowerCase().endsWith(ext))
  );

  return (
    <div className="space-y-4">
      {/* AI Renders */}
      {designs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Image className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-gray-800 text-base">AI Design Renders</h2>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">{designs.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {designs.map((d, i) => (
              <a key={i} href={d.url} target="_blank" rel="noreferrer"
                className="group rounded-xl overflow-hidden border border-gray-100 block relative">
                <img src={d.url} alt={`Design ${i + 1}`} loading="lazy" className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2">
                  <ExternalLink className="w-4 h-4 text-white" />
                </div>
                {d.prompt && (
                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-500 line-clamp-2">{d.prompt}</p>
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Documents */}
      {documents.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-gray-800 text-base">Project Documents</h2>
          </div>
          <div className="space-y-2">
            {documents.map((doc, i) => (
              <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-3 transition-colors group">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{doc.name || doc.original_name || `Document ${i + 1}`}</div>
                  {doc.category && <div className="text-xs text-gray-400">{doc.category}</div>}
                </div>
                <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {designs.length === 0 && documents.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Image className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Design files will appear here as your PM uploads them.</p>
        </div>
      )}
    </div>
  );
}

// ── Estimate / Change Order View ─────────────────────────────────────────────
function EstimateView({ estimate, isChangeOrder, expanded, onToggle, token, project, onApproved }) {
  const [approving, setApproving] = useState(false);
  const [approvalDone, setApprovalDone] = useState(false);
  const [approvalError, setApprovalError] = useState(null);
  const [showSignature, setShowSignature] = useState(false);

  const handleApproveWithSignature = async (signatureData) => {
    if (!token) return;
    setApproving(true);
    setApprovalError(null);
    try {
      await base44.functions.invoke("processApproval", {
        token,
        action: "approve",
        estimate_id: estimate.id,
        signature_data: signatureData,
        notes: `Change Order #${estimate.change_order_number} signed electronically`,
      });
      setApprovalDone(true);
      setShowSignature(false);
      onApproved?.();
    } catch (err) {
      // Never pretend it worked — the office wouldn't know to proceed.
      setApprovalError(err?.response?.data?.error || err.message || "Something went wrong. Please try again or call us at (617) 857-COEN.");
    }
    setApproving(false);
  };

  const groups = (estimate.line_items || []).reduce((acc, item) => {
    const g = item.parent_group || "General";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
        <div className="text-left">
          <div className="font-bold text-gray-800">
            {isChangeOrder ? `Change Order #${estimate.change_order_number}` : "Project Estimate"}
          </div>
          {estimate.scope_change_description && (
            <div className="text-sm text-gray-500 mt-0.5">{estimate.scope_change_description}</div>
          )}
          <div className="text-xs text-gray-400 mt-1">
            {(estimate.line_items || []).length} items ·{" "}
            <span className={`font-semibold ${
              estimate.status === "approved" ? "text-green-600" :
              estimate.status === "sent" ? "text-blue-600" : "text-gray-500"
            }`}>
              {estimate.status === "sent" ? "Ready for your review" : estimate.status === "approved" ? "✓ Approved" : estimate.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-secondary">${(estimate.grand_total || 0).toLocaleString()}</span>
          {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="bg-slate-50 px-5 py-2.5 flex justify-between items-center border-b border-gray-100">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{group}</span>
                <span className="text-xs font-bold text-primary">
                  ${items.reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}
                </span>
              </div>
              {items.map(item => (
                <div key={item.id} className="px-5 py-3 flex justify-between items-start gap-4 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {item.description.replace(/\*\*/g, "").replace(/\*/g, "")}
                      </div>
                    )}
                    {(item.quantity && item.unit) && (
                      <div className="text-xs text-gray-400 mt-0.5">{item.quantity} {item.unit}</div>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-800 shrink-0">${(item.total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}

          {estimate.tax_amount > 0 && (
            <div className="flex justify-between px-5 py-2.5 border-t border-gray-100 text-sm text-gray-500">
              <span>Tax ({estimate.tax_rate}%)</span>
              <span>${(estimate.tax_amount || 0).toLocaleString()}</span>
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-4 bg-secondary">
            <span className="text-white font-bold text-lg">Total</span>
            <span className="text-primary font-bold text-2xl">${(estimate.grand_total || 0).toLocaleString()}</span>
          </div>

          {estimate.notes && (
            <div className="px-5 py-4 bg-slate-50 border-t border-gray-100">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Notes & Terms</div>
              <p className="text-sm text-gray-600 leading-relaxed">{estimate.notes}</p>
            </div>
          )}

          {estimate.valid_until && (
            <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 text-xs text-blue-600 font-medium text-center">
              This estimate is valid until {parseLocalDate(estimate.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          )}

          {/* Electronic Approval for change orders with status "sent" */}
          {isChangeOrder && estimate.status === "sent" && (
            <div className="px-5 py-4 border-t border-gray-100 bg-amber-50 space-y-3">
              <p className="text-sm font-semibold text-amber-900 text-center">This change order requires your approval</p>
              {approvalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
                  {approvalError}
                </div>
              )}
              {approvalDone || estimate.status === "approved" ? (
                <div className="flex items-center justify-center gap-2 bg-green-100 text-green-700 rounded-xl py-3 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" /> Approved — thank you!
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSignature(true)}
                    disabled={approving}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 font-bold text-sm transition-colors disabled:opacity-60"
                  >
                    <PenLine className="w-4 h-4" /> {approving ? "Processing…" : "Sign & Approve"}
                  </button>
                  <a href="tel:6178572636"
                    className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl px-4 py-3 text-sm font-semibold transition-colors">
                    <Phone className="w-4 h-4" /> Call Us
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Signature Modal */}
          {isChangeOrder && (
            <SignatureModal
              open={showSignature}
              onClose={() => setShowSignature(false)}
              onSign={handleApproveWithSignature}
              projectTitle={`Change Order #${estimate.change_order_number}`}
              amount={estimate.grand_total || 0}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Payment Schedule (customer view) ────────────────────────────────────────
// The Schedule of Payments the office set up (Exhibit B of the contract):
// what's been paid, what's due now, and what's coming — labels and amounts
// only, none of the internal gating.
function PaymentScheduleView({ milestones }) {
  const total = milestones.reduce((s, m) => s + (m.amount || 0), 0);
  const paid = milestones.filter(m => m.status === "paid").reduce((s, m) => s + (m.amount || 0), 0);
  const fmt = (n) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const STATUS_STYLES = {
    paid:     { label: "Paid",     chip: "bg-green-100 text-green-700",  icon: CheckCircle2 },
    due:      { label: "Due Now",  chip: "bg-amber-100 text-amber-700",  icon: AlertCircle },
    upcoming: { label: "Upcoming", chip: "bg-gray-100 text-gray-500",    icon: Clock },
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-gray-800 text-base">Schedule of Payments</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">Your project's payment milestones, as set forth in your contract.</p>

        {/* Progress */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span><strong className="text-green-600">${fmt(paid)}</strong> paid</span>
            <span>of <strong className="text-gray-700">${fmt(total)}</strong></span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${total > 0 ? Math.min(100, (paid / total) * 100) : 0}%` }} />
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-2.5">
          {milestones.map((m, i) => {
            const st = STATUS_STYLES[m.status] || STATUS_STYLES.upcoming;
            const StIcon = st.icon;
            return (
              <div key={i} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${m.status === "due" ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-slate-50"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.status === "paid" ? "bg-green-500 text-white" : "bg-secondary text-white"}`}>
                  {m.status === "paid" ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{m.label}</div>
                  <div className="text-xs text-gray-400 capitalize">
                    {m.trigger || ""}
                    {m.due_date ? ` · due ${parseLocalDate(m.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-gray-800">${fmt(m.amount)}</div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.chip}`}>
                    <StIcon className="w-2.5 h-2.5" /> {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}