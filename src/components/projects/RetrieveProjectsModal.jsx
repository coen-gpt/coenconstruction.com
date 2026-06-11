import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertCircle, Loader2, FolderOpen, ChevronRight, ImageIcon } from 'lucide-react';

const TYPE_LABELS = {
  home_addition: 'Home Addition',
  deck_remodel: 'Deck / Porch / Pergola',
  kitchen_remodel: 'Kitchen Remodel',
  bathroom_remodel: 'Bathroom Remodel',
  other: 'Renovation Project',
};

export default function RetrieveProjectsModal({ open, onOpenChange }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundProjects, setFoundProjects] = useState(null);

  const handleRetrieve = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await base44.functions.invoke('getProjectsByEmail', { email });
      const projects = res.data?.projects || [];

      if (projects.length === 0) {
        setError('No projects found with this email address.');
        setLoading(false);
        return;
      }

      if (projects.length === 1) {
        window.location.href = `/project?id=${projects[0].id}`;
        return;
      }

      setFoundProjects(projects);
      setLoading(false);
    } catch (err) {
      setError('Error retrieving projects. Please try again.');
      setLoading(false);
    }
  };

  const handleClose = (isOpen) => {
    if (!isOpen) {
      setFoundProjects(null);
      setError('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retrieve My Projects</DialogTitle>
        </DialogHeader>

        {foundProjects ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We found {foundProjects.length} projects for {email}. Select one to view:
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {foundProjects.map((p) => (
                <a
                  key={p.id}
                  href={`/project?id=${p.id}`}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group"
                >
                  <FolderOpen className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-secondary group-hover:text-primary truncate">
                      {TYPE_LABELS[p.project_type] || 'Renovation Project'}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      {p.created_date && <span>{new Date(p.created_date).toLocaleDateString()}</span>}
                      {(p.ai_designs?.length || 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> {p.ai_designs.length} design{p.ai_designs.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary shrink-0" />
                </a>
              ))}
            </div>
            <Button variant="outline" className="w-full rounded-lg" onClick={() => setFoundProjects(null)}>
              Search a different email
            </Button>
          </div>
        ) : (
        <form onSubmit={handleRetrieve} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the email address you used when creating your project to view your designs and renderings.
          </p>

          <Input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="rounded-lg"
          />

          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Find My Projects
              </>
            )}
          </Button>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
