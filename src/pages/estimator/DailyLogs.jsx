import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList, Plus, Camera, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import { format } from "date-fns";

export default function DailyLogs() {
  const { brandColor } = useCompanyBrand();
  const qc = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");
  const [expandedLog, setExpandedLog] = useState(null);
  const [newEntry, setNewEntry] = useState({ date: format(new Date(), "yyyy-MM-dd"), notes: "", weather: "", crew_count: "", photos: [] });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-logs"],
    queryFn: () => base44.entities.ContractorProject.filter({ status: "in_progress" }),
  });

  const allProjects = useQuery({
    queryKey: ["all-projects-logs"],
    queryFn: () => base44.entities.ContractorProject.list("-updated_date", 50),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["daily-logs", selectedProject],
    queryFn: () => base44.entities.DailyLog.filter(selectedProject ? { project_id: selectedProject } : {}, "-date", 50),
    enabled: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DailyLog.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-logs"] }),
  });

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setNewEntry(prev => ({ ...prev, photos: [...prev.photos, ...urls] }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!newEntry.notes.trim() || !selectedProject) return;
    setSaving(true);
    await base44.entities.DailyLog.create({ ...newEntry, project_id: selectedProject });
    qc.invalidateQueries({ queryKey: ["daily-logs"] });
    setNewEntry({ date: format(new Date(), "yyyy-MM-dd"), notes: "", weather: "", crew_count: "", photos: [] });
    setSaving(false);
  };

  const allProjectsList = allProjects.data || [];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: brandColor + "20" }}>
          <ClipboardList className="w-5 h-5" style={{ color: brandColor }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-secondary">Daily Logs</h1>
          <p className="text-sm text-gray-500">Jobsite notes, crew activity & photo documentation</p>
        </div>
      </div>

      {/* Project filter */}
      <div className="mb-5">
        <select
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Projects</option>
          {allProjectsList.map(p => (
            <option key={p.id} value={p.id}>{p.client_name} — {p.project_type}</option>
          ))}
        </select>
      </div>

      {/* New Log Entry */}
      {selectedProject && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h2 className="font-semibold text-secondary mb-4 text-sm">New Log Entry</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date</label>
              <Input type="date" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Weather</label>
              <Input value={newEntry.weather} onChange={e => setNewEntry(p => ({ ...p, weather: e.target.value }))} placeholder="Sunny, 72°F" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Crew Count</label>
              <Input type="number" value={newEntry.crew_count} onChange={e => setNewEntry(p => ({ ...p, crew_count: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Notes / Work Completed</label>
            <textarea
              value={newEntry.notes}
              onChange={e => setNewEntry(p => ({ ...p, notes: e.target.value }))}
              placeholder="Describe work completed today, issues, decisions made..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Photo upload */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 block mb-2">Jobsite Photos</label>
            <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors w-fit">
              <Camera className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">{uploading ? "Uploading..." : "Add Photos"}</span>
              <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
            </label>
            {newEntry.photos.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {newEntry.photos.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving || !newEntry.notes.trim()} className="gap-2">
            <Plus className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Log Entry"}
          </Button>
        </div>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{selectedProject ? "No logs yet for this project." : "Select a project to view logs."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex-1">
                  <div className="font-semibold text-secondary text-sm">{log.date}</div>
                  <div className="text-xs text-gray-400 line-clamp-1">{log.notes}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {log.weather && <span className="text-xs text-gray-400">{log.weather}</span>}
                  {log.crew_count && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{log.crew_count} crew</span>}
                  {log.photos?.length > 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{log.photos.length} 📷</span>}
                  {expandedLog === log.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
              {expandedLog === log.id && (
                <div className="px-5 pb-4 border-t border-gray-100 bg-gray-50">
                  <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{log.notes}</p>
                  {log.photos?.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {log.photos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => deleteMutation.mutate(log.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 gap-1 mt-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}