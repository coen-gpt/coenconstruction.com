import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Image, Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import Testimonials from '../components/website/Testimonials';
import ServiceAreasSection from '../components/website/ServiceAreasSection';

const projectTypeLabels = {
  home_addition: 'Home Addition',
  deck_remodel: 'Deck Remodel',
  kitchen_remodel: 'Kitchen Remodel',
  bathroom_remodel: 'Bathroom Remodel',
  other: 'Other'
};

const statusColors = {
  new_lead: 'bg-blue-100 text-blue-700',
  designing: 'bg-amber-100 text-amber-700',
  design_complete: 'bg-green-100 text-green-700',
  contacted: 'bg-purple-100 text-purple-700'
};

const statusLabels = {
  new_lead: 'New',
  designing: 'Designing',
  design_complete: 'Complete',
  contacted: 'Contacted'
};

function decodeToken(token) {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded);
    const [email, expiry] = decoded.split('|');
    if (!email || !expiry) return null;
    if (Date.now() > parseInt(expiry)) return null; // expired
    return email;
  } catch {
    return null;
  }
}

export default function MyProjects() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const tokenEmail = token ? decodeToken(token) : null;
  const tokenExpired = token && !tokenEmail;

  const { data: projects, isLoading } = useQuery({
    queryKey: ['my-projects', tokenEmail],
    queryFn: async () => {
      if (tokenEmail) {
        // Project reads are RLS-locked to the creator — magic-link visitors
        // are anonymous, so the lookup must go through the backend function.
        const res = await base44.functions.invoke('getProjectsByEmail', { email: tokenEmail });
        return res.data?.projects || [];
      }
      const user = await base44.auth.me();
      return base44.entities.Project.filter({ created_by: user.email }, '-created_date');
    },
    initialData: []
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {tokenExpired && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-4 rounded-xl mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              This magic link has expired. Please request a new one from the homepage.
            </div>
          )}
          {tokenEmail && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 p-4 rounded-xl mb-6">
              Showing projects for <span className="font-semibold ml-1">{tokenEmail}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="font-heading text-3xl md:text-4xl mb-2">My Projects</h1>
              <p className="text-muted-foreground">View your design concepts and project details</p>
            </div>
            <Link to="/start">
              <Button className="rounded-xl gap-2 px-6">
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Image className="w-10 h-10 text-primary" />
              </div>
              <h3 className="font-heading text-2xl mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground mb-6">Start your first project and see your dream home come to life!</p>
              <Link to="/start">
                <Button className="rounded-xl gap-2 px-8">
                  Start Your First Design <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((project, i) => {
                const thumbnail = project.ai_designs?.[0]?.url || project.before_photos?.[0] || null;
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Link to={`/project?id=${project.id}`}>
                      <div className="group rounded-2xl overflow-hidden border border-border bg-card hover:shadow-xl transition-all duration-300">
                        <div className="h-48 bg-muted overflow-hidden">
                          {thumbnail ? (
                            <img src={thumbnail} alt={project.project_type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Image className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-heading text-lg">{projectTypeLabels[project.project_type] || 'Project'}</h3>
                            <Badge className={statusColors[project.status] || 'bg-muted text-muted-foreground'}>
                              {statusLabels[project.status] || project.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.project_description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(project.created_date), 'MMM d, yyyy')}
                            </span>
                            {project.ai_designs?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Image className="w-3 h-3" />
                                {project.ai_designs.length} design{project.ai_designs.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Testimonials — white background */}
      <div className="bg-white">
        <Testimonials darkBg={false} />
      </div>

      {/* Service Areas — orange primary background */}
      <div className="bg-primary">
        <ServiceAreasSection />
      </div>

      <Footer />
    </div>
  );
}