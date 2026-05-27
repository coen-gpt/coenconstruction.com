import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, FileText, Upload, CheckCircle, DollarSign, Loader2 } from "lucide-react";

export default function SubBidPortal() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [state, setState] = useState("loading"); // loading | ready | submitted | error
  const [subBid, setSubBid] = useState(null);
  const [project, setProject] = useState(null);
  const [company, setCompany] = useState(null);

  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("error"); return; }
    loadData();
  }, [token]);

  const loadData = async () => {
    const bids = await base44.entities.SubBid.filter({ invite_token: token });
    if (!bids.length) { setState("error"); return; }
    const bid = bids[0];
    setSubBid(bid);

    const [projects, profiles] = await Promise.all([
      base44.entities.ContractorProject.filter({ id: bid.project_id }),
      base44.entities.CompanyProfile.list(),
    ]);
    setProject(projects[0] || null);
    setCompany(profiles[0] || null);

    if (bid.status === "submitted" || bid.status === "selected") {
      setState("submitted");
    } else {
      // Mark as viewed
      if (bid.status === "invited") {
        await base44.entities.SubBid.update(bid.id, { status: "viewed" });
      }
      setState("ready");
    }
  };

  const handleSubmit = async () => {
    if (!bidAmount || isNaN(parseFloat(bidAmount))) return;
    setSubmitting(true);

    let pdfUrl = null;
    if (pdfFile) {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });
      pdfUrl = file_url;
      setUploading(false);
    }

    await base44.entities.SubBid.update(subBid.id, {
      bid_amount: parseFloat(bidAmount),
      bid_notes: bidNotes,
      quote_pdf_url: pdfUrl,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    });

    setState("submitted");
    setSubmitting(false);
  };

  const brandColor = company?.brand_color || "#E35235";
  const companyName = company?.company_name || "General Contractor";

  if (state === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );

  if (state === "error") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-sm">
        <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h1 className="text-xl font-bold text-gray-700 mb-2">Invalid or Expired Link</h1>
        <p className="text-gray-500 text-sm">This bid invitation link is invalid or has already been used. Please contact the general contractor.</p>
      </div>
    </div>
  );

  if (state === "submitted") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: brandColor + "20" }}>
          <CheckCircle className="w-8 h-8" style={{ color: brandColor }} />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Bid Submitted!</h1>
        <p className="text-gray-500 text-sm">Your bid has been received by {companyName}. You'll be notified of their decision.</p>
        {subBid?.bid_amount && (
          <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Your submitted bid</div>
            <div className="text-2xl font-bold" style={{ color: brandColor }}>${parseFloat(subBid.bid_amount).toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white py-5 px-6" style={{ background: "#1B2B3A" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {company?.logo_url ? (
            <img src={company.logo_url} alt={companyName} className="h-8 object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: brandColor }}>
              {companyName.charAt(0)}
            </div>
          )}
          <div>
            <div className="font-bold text-sm">{companyName}</div>
            <div className="text-white/50 text-xs">Subcontractor Bid Portal</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-5">
        {/* Project Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-secondary">Project Details</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Client / Project</div>
              <div className="font-medium text-secondary">{project?.client_name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Project Type</div>
              <div className="font-medium text-secondary">{project?.project_type}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Location</div>
              <div className="font-medium text-secondary">{project?.client_address}{project?.client_city ? `, ${project.client_city}` : ""}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Trade Requested</div>
              <div className="font-bold" style={{ color: brandColor }}>{subBid?.trade}</div>
            </div>
          </div>
          {subBid?.vendor_name && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
              Bid requested for: <span className="font-semibold text-gray-600">{subBid.vendor_company || subBid.vendor_name}</span>
            </div>
          )}
        </div>

        {/* Scope of Work */}
        {project?.scope_of_work && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-secondary">Scope of Work</span>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{project.scope_of_work}</div>
          </div>
        )}

        {/* Bid Form */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-secondary">Submit Your Bid</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Your Bid Amount *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <Input
                  type="number"
                  value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7 text-lg font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Notes / Exclusions / Inclusions
              </label>
              <textarea
                value={bidNotes}
                onChange={e => setBidNotes(e.target.value)}
                placeholder="Describe what's included/excluded, timeline, payment terms..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Upload Quote PDF (Optional)
              </label>
              <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600 font-medium">{pdfFile ? pdfFile.name : "Click to upload PDF"}</div>
                  <div className="text-xs text-gray-400">PDF, Word, or image files</div>
                </div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={e => setPdfFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!bidAmount || submitting || uploading}
              className="w-full py-3 text-base font-bold gap-2"
              style={{ background: brandColor }}
            >
              {submitting || uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? "Uploading..." : "Submitting..."}</>
                : <><CheckCircle className="w-4 h-4" /> Submit Bid</>
              }
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          This portal is secured with a unique link. Your submission is sent directly to {companyName}.
        </p>
      </div>
    </div>
  );
}