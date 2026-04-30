import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, FileUp, X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function PhotoUpload({ project, onUpdate, onNext, onBack }) {
  const [uploading, setUploading] = useState(null);
  const beforeRef = useRef();
  const inspoRef = useRef();
  const docRef = useRef();

  const handleUpload = async (files, type) => {
    setUploading(type);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    const current = project[type] || [];
    await onUpdate({ [type]: [...current, ...urls] });
    setUploading(null);
  };

  const removeFile = async (type, index) => {
    const updated = [...(project[type] || [])];
    updated.splice(index, 1);
    await onUpdate({ [type]: updated });
  };

  const FileGrid = ({ files, type, label }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
      {(files || []).map((url, i) => (
        <div key={i} className="relative group rounded-xl overflow-hidden aspect-square bg-muted">
          {url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
            <img src={url} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileUp className="w-8 h-8 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mt-1">Document</span>
            </div>
          )}
          <button
            onClick={() => removeFile(type, i)}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div className="mb-8">
        <h2 className="font-heading text-2xl md:text-3xl mb-2">Upload Your Photos & Files</h2>
        <p className="text-muted-foreground">
          The more photos and details you share, the better our AI can visualize your project!
        </p>
      </div>

      {/* Before Photos */}
      <div className="p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-card">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Current / Before Photos</h3>
            <p className="text-sm text-muted-foreground">Photos of your space as it is now</p>
          </div>
        </div>
        <input
          ref={beforeRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(Array.from(e.target.files), 'before_photos')}
        />
        <Button
          variant="outline"
          className="rounded-xl mt-3 gap-2"
          onClick={() => beforeRef.current.click()}
          disabled={uploading === 'before_photos'}
        >
          {uploading === 'before_photos' ? 'Uploading...' : 'Upload Before Photos'}
          <Camera className="w-4 h-4" />
        </Button>
        <FileGrid files={project.before_photos} type="before_photos" label="Before" />
      </div>

      {/* Inspiration Photos */}
      <div className="p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-card">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-accent/10">
            <ImagePlus className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold">Inspiration / Idea Photos</h3>
            <p className="text-sm text-muted-foreground">Examples of designs you love from Pinterest, magazines, etc.</p>
          </div>
        </div>
        <input
          ref={inspoRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(Array.from(e.target.files), 'inspiration_photos')}
        />
        <Button
          variant="outline"
          className="rounded-xl mt-3 gap-2"
          onClick={() => inspoRef.current.click()}
          disabled={uploading === 'inspiration_photos'}
        >
          {uploading === 'inspiration_photos' ? 'Uploading...' : 'Upload Inspiration Photos'}
          <ImagePlus className="w-4 h-4" />
        </Button>
        <FileGrid files={project.inspiration_photos} type="inspiration_photos" label="Inspiration" />
      </div>

      {/* Documents */}
      <div className="p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-card">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-muted">
            <FileUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Documents & Schedules (Optional)</h3>
            <p className="text-sm text-muted-foreground">Floor plans, permits, schedules, or any other documents</p>
          </div>
        </div>
        <input
          ref={docRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(Array.from(e.target.files), 'documents')}
        />
        <Button
          variant="outline"
          className="rounded-xl mt-3 gap-2"
          onClick={() => docRef.current.click()}
          disabled={uploading === 'documents'}
        >
          {uploading === 'documents' ? 'Uploading...' : 'Upload Documents'}
          <FileUp className="w-4 h-4" />
        </Button>
        <FileGrid files={project.documents} type="documents" label="Document" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="rounded-xl px-8 py-6 gap-2">
          <ArrowLeft className="w-5 h-5" />
          Back
        </Button>
        <Button onClick={onNext} size="lg" className="rounded-xl px-10 py-6 text-lg gap-2 shadow-lg shadow-primary/20">
          <Sparkles className="w-5 h-5" />
          Generate AI Design
        </Button>
      </div>
    </motion.div>
  );
}