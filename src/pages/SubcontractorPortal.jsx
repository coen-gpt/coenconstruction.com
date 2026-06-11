import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  HardHat, AlertCircle, Phone, Loader2,
  ClipboardList, Shield, FileText
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SubProjectsTab from "@/components/subportal/SubProjectsTab";
import SubFormsTab from "@/components/subportal/SubFormsTab";
import SubComplianceTab from "@/components/subportal/SubComplianceTab";

const TABS = [
  { id: "projects",   label: "My Projects",  icon: ClipboardList },
  { id: "forms",      label: "My Forms",      icon: FileText },
  { id: "compliance", label: "Compliance",    icon: Shield },
];

export default function SubcontractorPortal() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("projects");

  const token = searchParams.get("token");
  const projectId = searchParams.get("project"); // legacy link support

  const loadDashboard = () => {
    return base44.functions.invoke("getSubDashboard", { token }).then(res => {
      setData(res.data);
    });
  };

  useEffect(() => {
    if (!token) { setError("invalid_link"); setLoading(false); return; }

    loadDashboard()
      .catch(() => {
        if (projectId) {
          return base44.functions.invoke("getSubcontractorPortal", { token, project_id: projectId })
            .then(res => {
              setData({
                sub_name: res.data?.assignment?.subcontractor_name || "",
                sub_email: res.data?.assignment?.subcontractor_email || "",
                vendor: null,
                assignments: [{ project: res.data.project, milestone: res.data.milestone, assignment: { ...res.data.assignment, token } }],
              });
            });
        }
        throw new Error("invalid");
      })
      .catch(() => setError("invalid"))
      .finally(() => setLoading(false));
  }, [token]);

  // Switch to forms tab if packet not done and coming from onboarding link
  useEffect(() => {
    if (data && searchParams.get("tab") === "forms") setActiveTab("forms");
    else if (data && data.vendor && !["completed", "approved"].includes(data.vendor.packet_status) && !searchParams.get("tab")) {
      setActiveTab("forms");
    }
  }, [data]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
        <HardHat className="w-7 h-7 text-white" />
      </div>
      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      <p className="text-gray-500 text-sm">Loading your portal…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h2>
        <p className="text-gray-500 mb-6 text-sm">
          {error === "invalid_link"
            ? "This link is missing required information. Please check your email or SMS."
            : "This link may have expired or is invalid. Please contact Coen Construction for a new link."}
        </p>
        <a href="tel:+17819995400" className="flex items-center justify-center gap-2 bg-primary text-white font-semibold rounded-xl py-3 px-6">
          <Phone className="w-4 h-4" /> Call: (781) 999-5400
        </a>
      </div>
    </div>
  );

  const { sub_name, vendor, assignments = [] } = data;
  const packetDone = ["completed", "approved"].includes(vendor?.packet_status);
  const activeCount = assignments.filter(a => a.assignment.status !== "complete").length;
  const complianceScore = [packetDone, !!vendor?.workers_comp_url, !!vendor?.liability_ins_url, !!vendor?.w9_url].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-secondary px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-lg leading-tight">Subcontractor Portal</h1>
            <p className="text-white/60 text-xs">Coen Construction LLC</p>
          </div>
          {sub_name && (
            <div className="text-right shrink-0">
              <div className="text-white/60 text-xs">Welcome back,</div>
              <div className="text-white font-semibold text-sm truncate max-w-[140px]">{sub_name}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
            <div className="text-gray-400 text-xs">Active Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{assignments.filter(a => a.assignment.status === "complete").length}</div>
            <div className="text-gray-400 text-xs">Completed</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${complianceScore === 4 ? "text-green-600" : "text-amber-500"}`}>{complianceScore}/4</div>
            <div className="text-gray-400 text-xs">Compliance</div>
          </div>
          {!packetDone && vendor && (
            <button
              onClick={() => setActiveTab("forms")}
              className="ml-auto self-center flex items-center gap-1 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
            >
              ⚠️ Complete Onboarding
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 flex py-1 gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const badge = tab.id === "projects" ? activeCount : tab.id === "compliance" ? (4 - complianceScore || null) : (!packetDone ? "!" : null);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors
                  ${active ? "bg-primary/10 text-primary" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-xs">{tab.label.split(" ")[1] || tab.label.split(" ")[0]}</span>
                {badge > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {activeTab === "projects" && (
          <SubProjectsTab
            assignments={assignments}
            token={token}
            onRefresh={loadDashboard}
            toast={toast}
          />
        )}
        {activeTab === "forms" && (
          <SubFormsTab
            vendor={vendor}
            token={token}
            onComplete={() => { loadDashboard(); setActiveTab("compliance"); }}
            toast={toast}
          />
        )}
        {activeTab === "compliance" && (
          <SubComplianceTab
            vendor={vendor}
            onGoToForms={() => setActiveTab("forms")}
          />
        )}
      </div>

      <div className="text-center text-gray-400 text-xs pb-8">
        Questions? <a href="tel:+17819995400" className="underline">(781) 999-5400</a> ·{" "}
        <a href="mailto:coenconstruction@gmail.com" className="underline">coenconstruction@gmail.com</a>
      </div>
    </div>
  );
}