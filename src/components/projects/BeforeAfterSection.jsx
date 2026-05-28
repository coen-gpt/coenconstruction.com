import React, { useState } from 'react';
import { Image, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

export default function BeforeAfterSection({ project, onSelectImage }) {
  const beforePhotos = project.before_photos || [];
  const aiDesigns = project.ai_designs || [];
  const [beforeIdx, setBeforeIdx] = useState(0);
  const [afterIdx, setAfterIdx] = useState(0);

  if (beforePhotos.length === 0 && aiDesigns.length === 0) return null;

  return (
    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
      <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        Before &amp; After
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Before */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Before</p>
          {beforePhotos.length > 0 ? (
            <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-muted group cursor-pointer"
              onClick={() => onSelectImage(beforePhotos[beforeIdx])}>
              <img
                src={beforePhotos[beforeIdx]}
                alt="Before"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {beforePhotos.length > 1 && (
                <div className="absolute inset-0 flex items-center justify-between px-2">
                  <button className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setBeforeIdx(i => (i - 1 + beforePhotos.length) % beforePhotos.length); }}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setBeforeIdx(i => (i + 1) % beforePhotos.length); }}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              {beforePhotos.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {beforePhotos.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === beforeIdx ? 'bg-white' : 'bg-white/40'}`} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[4/3] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground">
              <Image className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs">No photos uploaded</p>
            </div>
          )}
        </div>

        {/* After */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            After <span className="text-primary font-medium normal-case tracking-normal">(AI Design)</span>
          </p>
          {aiDesigns.length > 0 ? (
            <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-muted group cursor-pointer"
              onClick={() => onSelectImage(aiDesigns[afterIdx].url)}>
              <img
                src={aiDesigns[afterIdx].url}
                alt="AI Design"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-2 left-2">
                <span className="flex items-center gap-1 text-xs bg-primary/90 text-white px-2 py-0.5 rounded-full font-medium">
                  <Sparkles className="w-3 h-3" /> AI Concept
                </span>
              </div>
              {aiDesigns.length > 1 && (
                <div className="absolute inset-0 flex items-center justify-between px-2">
                  <button className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setAfterIdx(i => (i - 1 + aiDesigns.length) % aiDesigns.length); }}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setAfterIdx(i => (i + 1) % aiDesigns.length); }}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              {aiDesigns.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {aiDesigns.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === afterIdx ? 'bg-white' : 'bg-white/40'}`} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[4/3] rounded-xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center text-muted-foreground bg-primary/5">
              <Sparkles className="w-8 h-8 mb-2 text-primary/40" />
              <p className="text-xs">Generate a design to see it here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}