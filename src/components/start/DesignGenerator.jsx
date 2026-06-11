import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Download, RefreshCw, ArrowLeft, Eye, Loader2, Wand2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ProjectBudgetWidget from '@/components/projects/ProjectBudgetWidget';
import BudgetTimeline from './BudgetTimeline';
import InspirationUploader from './InspirationUploader';
import ProjectCustomizer from './ProjectCustomizer';
import { DesignPreviewEvents } from '@/lib/analytics';

const projectTypeLabels = {
  home_addition: 'Home Addition',
  deck_remodel: 'Deck Remodel',
  kitchen_remodel: 'Kitchen Remodel',
  bathroom_remodel: 'Bathroom Remodel',
  other: 'Project'
};

export default function DesignGenerator({ project, onUpdate, onBack }) {
  const [generating, setGenerating] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [showCustomization, setShowCustomization] = useState(false);

  // Track tool opened
  useEffect(() => {
    DesignPreviewEvents.toolOpened(project.project_type);
  }, []);

  const generateDesign = async () => {
    setGenerating(true);
    DesignPreviewEvents.generateStarted(
      project.project_type,
      (project.before_photos?.length || 0) > 0,
      (project.inspiration_photos?.length || 0) > 0
    );
    try {
      const styleStr = (project.style_preferences || []).join(', ');
      const typeLabel = projectTypeLabels[project.project_type] || 'home renovation';

      const prompt = `Create a beautiful, realistic architectural concept rendering of a ${typeLabel}. 
Project description: ${project.project_description}
${styleStr ? `Design style preferences: ${styleStr}` : ''}
${additionalNotes ? `Additional notes: ${additionalNotes}` : ''}

The rendering should be:
- A photorealistic architectural visualization
- Professional quality, like from an architecture firm
- Showing the completed, renovated space
- Well-lit and inviting
- High detail with realistic materials and textures
Do NOT include any text or labels in the image.`;

      const fileUrls = [];
      if (project.before_photos?.length > 0) {
        fileUrls.push(project.before_photos[0]);
      }
      if (project.inspiration_photos?.length > 0) {
        fileUrls.push(project.inspiration_photos[0]);
      }

      const result = await base44.integrations.Core.GenerateImage({
        prompt,
        existing_image_urls: fileUrls.length > 0 ? fileUrls : undefined
      });

      const newDesign = {
        url: result.url,
        prompt: prompt.substring(0, 300),
        created_at: new Date().toISOString()
      };

      const currentDesigns = project.ai_designs || [];
      const updatedDesigns = [...currentDesigns, newDesign];
      await onUpdate({
        ai_designs: updatedDesigns,
        status: 'design_complete',
        design_notes: additionalNotes || project.design_notes
      });
      DesignPreviewEvents.generateCompleted(project.project_type, updatedDesigns.length);
    } catch (error) {
      console.error('Design generation failed:', error);
      DesignPreviewEvents.generateFailed(project.project_type);
      alert('Failed to generate design. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const designs = project.ai_designs || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div className="mb-8">
        <h2 className="font-heading text-2xl md:text-3xl mb-2">
          {designs.length > 0 ? 'Your AI Design Concepts' : 'Let\'s Create Your Design!'}
        </h2>
        <p className="text-muted-foreground">
          {designs.length > 0
            ? 'Here are your concept designs. Generate more or refine your vision!'
            : 'Add any extra details, then let our AI work its magic.'}
        </p>
      </div>

      {/* Budget & Timeline */}
      {designs.length === 0 && (
        <BudgetTimeline project={project} onUpdate={onUpdate} />
      )}

      {/* Additional Inspiration Photos */}
      {designs.length === 0 && (
        <InspirationUploader project={project} onUpdate={onUpdate} />
      )}

      {/* Additional Notes */}
      <div className="p-6 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-3 mb-3">
          <Wand2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Extra Design Notes (optional)</h3>
        </div>
        <Textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="E.g., I want a large island with seating, white marble countertops, open shelving, natural light..."
          className="rounded-xl resize-none min-h-[80px]"
        />
        {(project.before_photos?.length || 0) === 0 && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            Tip: adding at least one photo of your current space (previous step) helps the AI tailor the design to your actual home.
          </p>
        )}
        <Button
          onClick={generateDesign}
          disabled={generating}
          size="lg"
          className="mt-4 rounded-xl px-8 gap-2 shadow-lg shadow-primary/20"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Your Design...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {designs.length > 0 ? 'Generate Another Design' : 'Generate AI Design'}
            </>
          )}
        </Button>
      </div>

      {/* Generating Animation */}
      {generating && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-12 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="inline-block mb-4"
          >
            <Sparkles className="w-12 h-12 text-primary" />
          </motion.div>
          <h3 className="font-heading text-xl mb-2">Our AI is designing your space...</h3>
          <p className="text-muted-foreground">This usually takes about 10-15 seconds. Hang tight!</p>
          <div className="mt-6 w-64 mx-auto h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: ['0%', '90%'] }}
              transition={{ duration: 12, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}

      {/* Design Gallery */}
      {designs.length > 0 && (
        <>
          {/* Customization Section */}
          {!showCustomization && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Happy with your design? Customize the details below:</p>
              <Button
                onClick={() => { setShowCustomization(true); DesignPreviewEvents.customizationOpened(); }}
                variant="outline"
                size="lg"
                className="rounded-xl"
              >
                Customize Your Design
              </Button>
            </div>
          )}

          {showCustomization && (
            <>
              <ProjectCustomizer project={project} onUpdate={onUpdate} />
              <BudgetTimeline project={project} onUpdate={onUpdate} />
              <InspirationUploader project={project} onUpdate={onUpdate} />
            </>
          )}

          <div className="space-y-4">
            <h3 className="font-heading text-xl flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Your Design Concepts ({designs.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {designs.map((design, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative rounded-2xl overflow-hidden shadow-lg cursor-pointer"
                  onClick={() => { setSelectedDesign(design); DesignPreviewEvents.designViewed(i); }}
                >
                  <img
                    src={design.url}
                    alt={`Design concept ${i + 1}`}
                    className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <span className="text-white text-sm font-medium">Concept {i + 1}</span>
                      <a
                        href={design.url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { e.stopPropagation(); DesignPreviewEvents.designDownloaded(i); }}
                        className="p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {selectedDesign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedDesign(null)}
          >
            <button
              onClick={() => setSelectedDesign(null)}
              aria-label="Close design preview"
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={selectedDesign.url}
              alt="Design concept"
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="rounded-xl px-8 py-6 gap-2">
          <ArrowLeft className="w-5 h-5" />
          Back to Photos
        </Button>
        {designs.length > 0 && (
          <Button
            variant="outline"
            onClick={generateDesign}
            disabled={generating}
            className="rounded-xl px-8 py-6 gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Another Variation
          </Button>
        )}
      </div>

      <ProjectBudgetWidget project={project} />
    </motion.div>
  );
}