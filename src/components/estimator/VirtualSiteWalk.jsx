import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Upload, MapPin, Trash2, Save, X, Eye } from "lucide-react";

/**
 * VirtualSiteWalk - 360° photo viewer with progress markers
 * Uses Pannellum library for equirectangular image viewing
 * Markers are stored in ContractorProject.photos_360 array
 */
export default function VirtualSiteWalk({ project, onUpdate }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [editingMarkers, setEditingMarkers] = useState(false);
  const [newMarker, setNewMarker] = useState(null);
  const [markerNote, setMarkerNote] = useState("");
  const [savingMarker, setSavingMarker] = useState(false);

  const photos360 = project?.photos_360 || [];
  const viewerRef = useRef(null);
  const pannellumInstance = useRef(null);

  // Load Pannellum dynamically
  useEffect(() => {
    if (!viewerOpen || !currentPhoto) return;

    const loadPannellum = async () => {
      // Load CSS
      if (!document.getElementById("pannellum-css")) {
        const link = document.createElement("link");
        link.id = "pannellum-css";
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css";
        document.head.appendChild(link);
      }

      // Load JS
      if (!window.pannellum) {
        await new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js";
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      // Initialize viewer
      if (viewerRef.current && window.pannellum) {
        pannellumInstance.current = window.pannellum.viewer(viewerRef.current, {
          default: {
            firstScene: "first",
            autoLoad: true,
            showControls: true,
            compass: true,
          },
          scenes: {
            first: {
              type: "equirectangular",
              panorama: currentPhoto.url,
              hotSpots: (currentPhoto.markers || []).map(m => ({
                pitch: m.pitch,
                yaw: m.yaw,
                type: "info",
                text: m.note,
                CSSclass: "custom-hotspot",
              })),
            },
          },
        });
      }
    };

    loadPannellum();

    return () => {
      if (pannellumInstance.current) {
        pannellumInstance.current.destroy();
        pannellumInstance.current = null;
      }
    };
  }, [viewerOpen, currentPhoto]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return {
            id: `photo360_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            url: file_url,
            name: file.name,
            uploaded_at: new Date().toISOString(),
            markers: [],
            thumbnail_url: file_url, // Could generate separate thumbnail
          };
        })
      );

      const updatedPhotos = [...photos360, ...uploaded];
      await base44.entities.ContractorProject.update(project.id, { photos_360: updatedPhotos });
      toast({ title: `${uploaded.length} 360° photo(s) uploaded`, description: "Virtual site walk updated." });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openViewer = (photo) => {
    setCurrentPhoto(photo);
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setCurrentPhoto(null);
    setEditingMarkers(false);
    setNewMarker(null);
  };

  const handlePhotoClick = (e) => {
    if (!editingMarkers || !pannellumInstance.current) return;

    const rect = viewerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Convert click to yaw/pitch (approximate)
    const yaw = (x - 0.5) * 360;
    const pitch = (0.5 - y) * 180;

    setNewMarker({ pitch, yaw });
  };

  const saveMarker = async () => {
    if (!newMarker || !markerNote.trim() || !currentPhoto) return;

    setSavingMarker(true);
    try {
      const updatedPhotos = photos360.map((p) => {
        if (p.id === currentPhoto.id) {
          return {
            ...p,
            markers: [
              ...(p.markers || []),
              {
                id: `marker_${Date.now()}`,
                pitch: newMarker.pitch,
                yaw: newMarker.yaw,
                note: markerNote.trim(),
                created_at: new Date().toISOString(),
              },
            ],
          };
        }
        return p;
      });

      await base44.entities.ContractorProject.update(project.id, { photos_360: updatedPhotos });
      setCurrentPhoto(updatedPhotos.find((p) => p.id === currentPhoto.id));
      setNewMarker(null);
      setMarkerNote("");
      toast({ title: "Progress marker added", description: "Marker saved to 360° photo." });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: "Failed to save marker", description: err.message, variant: "destructive" });
    } finally {
      setSavingMarker(false);
    }
  };

  const deleteMarker = async (markerId) => {
    if (!currentPhoto) return;

    try {
      const updatedPhotos = photos360.map((p) => {
        if (p.id === currentPhoto.id) {
          return {
            ...p,
            markers: (p.markers || []).filter((m) => m.id !== markerId),
          };
        }
        return p;
      });

      await base44.entities.ContractorProject.update(project.id, { photos_360: updatedPhotos });
      setCurrentPhoto(updatedPhotos.find((p) => p.id === currentPhoto.id));
      toast({ title: "Marker removed" });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: "Failed to delete marker", description: err.message, variant: "destructive" });
    }
  };

  const deletePhoto = async (photoId) => {
    const updated = photos360.filter((p) => p.id !== photoId);
    await base44.entities.ContractorProject.update(project.id, { photos_360: updated });
    toast({ title: "360° photo removed" });
    if (onUpdate) onUpdate();
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-secondary flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" /> Virtual Site Walk
          </h2>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-2" disabled={uploading} asChild>
              <span>
                {uploading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {uploading ? "Uploading…" : "Upload 360° Photo"}
              </span>
            </Button>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </label>
        </div>

        {photos360.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No 360° photos yet</p>
            <p className="text-sm mt-1">Upload equirectangular photos to create a virtual site walk.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos360.map((photo) => (
              <div key={photo.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img
                  src={photo.thumbnail_url || photo.url}
                  alt="360° view"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => openViewer(photo)}
                    className="gap-1 bg-primary text-white"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => deletePhoto(photo.id)}
                    variant="destructive"
                    className="gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {photo.markers?.length > 0 && (
                  <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded-full font-semibold">
                    {photo.markers.length} markers
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Viewer Modal */}
      {viewerOpen && currentPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
            <div>
              <h3 className="font-semibold text-lg">Virtual Site Walk</h3>
              <p className="text-sm text-gray-400">
                {currentPhoto.markers?.length || 0} progress marker(s)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={editingMarkers ? "default" : "outline"}
                size="sm"
                onClick={() => setEditingMarkers(!editingMarkers)}
                className={editingMarkers ? "bg-primary text-white" : "border-white text-white hover:bg-white/20"}
              >
                {editingMarkers ? (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1" /> Done Editing
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 mr-1" /> Add Markers
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={closeViewer}
                className="border-white text-white hover:bg-white/20"
              >
                <X className="w-3.5 h-3.5" /> Close
              </Button>
            </div>
          </div>

          {/* Viewer */}
          <div className="flex-1 relative" onClick={handlePhotoClick}>
            <div ref={viewerRef} className="w-full h-full" />

            {/* Marker Input Dialog */}
            {newMarker && editingMarkers && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl p-4 z-10 min-w-80">
                <h4 className="font-semibold text-secondary mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Add Progress Marker
                </h4>
                <Input
                  value={markerNote}
                  onChange={(e) => setMarkerNote(e.target.value)}
                  placeholder="Describe this progress milestone..."
                  className="mb-3"
                  onKeyDown={(e) => e.key === "Enter" && saveMarker()}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={saveMarker}
                    disabled={savingMarker || !markerNote.trim()}
                    className="flex-1 bg-primary text-white"
                    size="sm"
                  >
                    {savingMarker ? "Saving..." : "Save Marker"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewMarker(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Markers List */}
          {currentPhoto.markers?.length > 0 && (
            <div className="bg-white border-t border-gray-200 p-4 max-h-48 overflow-y-auto">
              <h4 className="font-semibold text-secondary mb-2 text-sm">Progress Markers</h4>
              <div className="space-y-2">
                {currentPhoto.markers.map((marker) => (
                  <div
                    key={marker.id}
                    className="flex items-start gap-2 bg-gray-50 rounded-lg p-2.5"
                  >
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{marker.note}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(marker.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {editingMarkers && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMarker(marker.id)}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}