import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Sparkles, Home, ArrowRight, Image, Camera, Send, Link2, Check } from 'lucide-react';
import SendDesignToCompanyModal from '../components/projects/SendDesignToCompanyModal';

const projectTypeLabels = {
  home_addition: 'Home Addition',
  deck_remodel: 'Deck Remodel',
  kitchen_remodel: 'Kitchen Remodel',
  bathroom_remodel: 'Bathroom Remodel',
  other: 'Other'
};

export default function SharedDesign() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  const [selectedImage, setSelectedImage] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // Clipboard unavailable — fail silently
    }
  };

  const { data: project, isLoading } = useQuery({
    queryKey: ['shared-project', projectId],
    // Project reads are RLS-locked to the creator — anonymous share-link
    // visitors must go through the sanitized backend endpoint.
    queryFn: async () => {
      const res = await base44.functions.invoke('getSharedDesign', { id: projectId }).catch(() => null);
      return res?.data?.project || null;
    },
    enabled: !!projectId
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-40 text-center px-6">
          <Image className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="font-heading text-2xl mb-2">Design Not Found</h2>
          <p className="text-muted-foreground mb-6">This link may have expired or the project was removed.</p>
          <Link to="/"><Button className="rounded-xl">Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  const designs = project.ai_designs || [];
  const beforePhotos = project.before_photos || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-5">
              <Sparkles className="w-4 h-4" />
              AI-Generated Design Concepts
            </div>
            <h1 className="font-heading text-3xl md:text-5xl mb-3">
              {projectTypeLabels[project.project_type] || 'Project'} Design
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {project.project_description}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
              <Home className="w-4 h-4" />
              <span>{project.address}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button size="sm" variant="outline" className="rounded-lg gap-2" onClick={() => setShowSendModal(true)}>
                <Send className="w-4 h-4" /> Interested? Send to Team
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg gap-2" onClick={copyLink}>
                {linkCopied ? <><Check className="w-4 h-4 text-green-600" /> Link Copied!</> : <><Link2 className="w-4 h-4" /> Copy Share Link</>}
              </Button>
            </div>
          </motion.div>

          {/* Before / After */}
          {(beforePhotos.length > 0 || designs.length > 0) && (
            <div className="mb-12">
              <h2 className="font-heading text-2xl font-bold text-center mb-6">Before &amp; After</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Before */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Before
                  </p>
                  {beforePhotos.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden shadow-lg aspect-[4/3] cursor-pointer"
                      onClick={() => setSelectedImage(beforePhotos[0])}>
                      <img src={beforePhotos[0]} alt="Before" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                      <p className="text-sm">No before photo</p>
                    </div>
                  )}
                </div>
                {/* After */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>After <span className="text-primary normal-case tracking-normal">(AI Design)</span></span>
                  </p>
                  {designs.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden shadow-lg aspect-[4/3] cursor-pointer relative group"
                      onClick={() => setSelectedImage(designs[0].url)}>
                      <img src={designs[0].url} alt="AI Design" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute top-3 left-3">
                        <span className="flex items-center gap-1 text-xs bg-primary/90 text-white px-2 py-1 rounded-full font-medium">
                          <Sparkles className="w-3 h-3" /> AI Concept
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-primary/30 flex items-center justify-center text-muted-foreground bg-primary/5">
                      <p className="text-sm">No AI design yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty state — only when there's nothing at all to show */}
          {beforePhotos.length === 0 && designs.length === 0 && (
            <div className="text-center py-16 text-muted-foreground mb-12">
              <Image className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No AI designs have been generated for this project yet.</p>
            </div>
          )}

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center p-10 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20"
          >
            <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="font-heading text-2xl mb-2">Love This? Get Your Own Design!</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Upload photos of your space and get a free AI concept design for your dream project.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="rounded-xl px-8 gap-2 shadow-lg shadow-primary/20" onClick={() => setShowSendModal(true)}>
                <Send className="w-5 h-5" /> Send Design to Coen Construction
              </Button>
              <Link to="/start" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="rounded-xl px-8 gap-2 w-full">
                  Start My Own Design <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Lightbox */}
          <AnimatePresence>
            {selectedImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                onClick={() => setSelectedImage(null)}
              >
                <div className="flex flex-col items-center gap-4">
                  <motion.img
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    src={selectedImage}
                    alt="Design concept"
                    className="max-w-full max-h-[70vh] rounded-xl shadow-2xl"
                  />
                  <Button onClick={(e) => { e.stopPropagation(); setShowSendModal(true); }} className="gap-2">
                    <Send className="w-4 h-4" /> Send This Design to Team
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showSendModal && (
            <SendDesignToCompanyModal
              project={project}
              aiDesigns={project?.ai_designs}
              onClose={() => setShowSendModal(false)}
              onSuccess={() => setShowSendModal(false)}
            />
          )}

        </div>
      </div>
      <Footer />
    </div>
  );
}