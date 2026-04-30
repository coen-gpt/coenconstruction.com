import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Upload, X, Image, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function InspirationUploader({ project, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const currentPhotos = project.inspiration_photos || [];

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const newPhotos = [...currentPhotos];

    for (const file of files) {
      const result = await base44.integrations.Core.UploadFile({ file });
      newPhotos.push(result.file_url);
    }

    await onUpdate({ inspiration_photos: newPhotos });
    setUploading(false);
  };

  const removePhoto = async (index) => {
    const updated = currentPhotos.filter((_, i) => i !== index);
    await onUpdate({ inspiration_photos: updated });
  };

  const generateVariation = async () => {
    if (currentPhotos.length === 0) return;

    setGenerating(true);
    const styleStr = (project.style_preferences || []).join(', ');
    const fileUrls = currentPhotos.slice(0, 3);

    const prompt = `Create a beautiful variation of the renovation concept based on these inspiration images and the customer's preferences.
Style: ${styleStr || 'Modern'}
Description: ${project.project_description}
Make this variation unique while maintaining the core design direction and keeping the same project type: ${project.project_type}`;

    const result = await base44.integrations.Core.GenerateImage({
      prompt,
      existing_image_urls: fileUrls
    });

    const newDesign = {
      url: result.url,
      prompt: prompt.substring(0, 300),
      created_at: new Date().toISOString()
    };

    const currentDesigns = project.ai_designs || [];
    await onUpdate({
      ai_designs: [...currentDesigns, newDesign]
    });

    setGenerating(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-card border border-border space-y-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <Image className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Add More Inspiration Photos</h3>
      </div>

      {/* Upload Area */}
      <label className="block">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors">
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Upload inspiration images</p>
          <p className="text-xs text-muted-foreground">JPG, PNG up to 10MB each</p>
        </div>
      </label>

      {/* Photo Gallery */}
      {currentPhotos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            {currentPhotos.length} photos uploaded
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <AnimatePresence>
              {currentPhotos.map((photo, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group rounded-lg overflow-hidden"
                >
                  <img
                    src={photo}
                    alt={`Inspiration ${i + 1}`}
                    className="w-full aspect-square object-cover"
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-1 rounded bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Generate Variation Button */}
      {currentPhotos.length > 0 && (
        <Button
          onClick={generateVariation}
          disabled={generating}
          variant="outline"
          size="lg"
          className="w-full rounded-xl gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating variation...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Design Variation
            </>
          )}
        </Button>
      )}
    </motion.div>
  );
}