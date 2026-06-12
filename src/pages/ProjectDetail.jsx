import usePageTitle from "@/hooks/usePageTitle";
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import DesignGenerator from '../components/start/DesignGenerator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Phone, Mail, User, Calendar, Image, Share2, Send } from 'lucide-react';
import ShareDesignModal from '../components/projects/ShareDesignModal';
import SendDesignModal from '../components/projects/SendDesignModal';
import BeforeAfterSection from '../components/projects/BeforeAfterSection';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const projectTypeLabels = {
  home_addition: 'Home Addition',
  deck_remodel: 'Deck Remodel',
  kitchen_remodel: 'Kitchen Remodel',
  bathroom_remodel: 'Bathroom Remodel',
  other: 'Other'
};

export default function ProjectDetail() {
  usePageTitle("Project Details");
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  // Magic-link token carried over from My Projects — keeps the page working
  // for customers who aren't logged in.
  const token = urlParams.get('token');
  const [selectedImage, setSelectedImage] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const { data: project, isLoading, isError, refetch } = useQuery({
    queryKey: ['project', projectId, token],
    queryFn: async () => {
      // Backend enforces ownership (own project, magic-link email match, or admin)
      const res = await base44.functions.invoke('getProjectById', { id: projectId, token });
      return res.data?.project || null;
    },
    enabled: !!projectId,
    retry: false,
  });

  const backHref = `/my-projects${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  const handleUpdate = async (updates) => {
    await base44.entities.Project.update(projectId, updates);
    refetch();
  };

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

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-40 text-center px-4">
          <h2 className="text-2xl font-bold text-secondary mb-2">Couldn't Load Project</h2>
          <p className="text-gray-500 mb-6">Please check your connection and try again, or use the link from your email.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
            <Link to={backHref}><Button variant="outline">← Back to Projects</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-40 text-center px-4">
          <h2 className="text-2xl font-bold text-secondary mb-2">Project Not Found</h2>
          <p className="text-gray-500 mb-6">This project may have been deleted or the link is incorrect.</p>
          <Link to="/"><Button variant="outline">← Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <Link to={backHref}>
              <Button variant="ghost" className="rounded-xl gap-2 -ml-2">
                <ArrowLeft className="w-4 h-4" /> Back to Projects
              </Button>
            </Link>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={() => setShareOpen(true)} variant="outline" className="rounded-xl gap-2 flex-1 sm:flex-none">
                <Share2 className="w-4 h-4" /> Share Designs
              </Button>
              <Button onClick={() => setSendOpen(true)} className="rounded-xl gap-2 shadow-lg shadow-primary/20 flex-1 sm:flex-none">
                <Send className="w-4 h-4" /> Send to Coen
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar */}
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-card border border-border">
                <h2 className="font-heading text-xl mb-4">Project Details</h2>
                <div className="space-y-4 text-sm">
                  <div>
                    <Badge className="mb-3">{projectTypeLabels[project.project_type]}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>{project.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{project.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{project.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{project.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{project.created_date ? format(new Date(project.created_date), 'MMM d, yyyy') : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border">
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{project.project_description}</p>
              </div>

              {/* Before Photos */}
              {project.before_photos?.length > 0 && (
                <div className="p-6 rounded-2xl bg-card border border-border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Image className="w-4 h-4" /> Before Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {project.before_photos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Before ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedImage(url)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {project.inspiration_photos?.length > 0 && (
                <div className="p-6 rounded-2xl bg-card border border-border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Image className="w-4 h-4" /> Inspiration Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {project.inspiration_photos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Inspiration ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedImage(url)}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Main Content - Design Generator + Before/After */}
            <div className="lg:col-span-2 space-y-6">
              <BeforeAfterSection project={project} onSelectImage={setSelectedImage} />
              <DesignGenerator
                project={project}
                onUpdate={handleUpdate}
                onBack={() => {}}
              />
            </div>
          </div>
        </div>
      </div>

      <ShareDesignModal open={shareOpen} onClose={() => setShareOpen(false)} project={project} />
      <SendDesignModal open={sendOpen} onClose={() => setSendOpen(false)} project={project} onSent={refetch} />

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
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={selectedImage}
              alt="Full view"
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}