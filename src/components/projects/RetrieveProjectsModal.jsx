import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertCircle, Loader2 } from 'lucide-react';

export default function RetrieveProjectsModal({ open, onOpenChange }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      const project = projects[0];
      window.location.href = `/project?id=${project.id}`;
    } catch (err) {
      setError('Error retrieving projects. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retrieve My Projects</DialogTitle>
        </DialogHeader>
        
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
      </DialogContent>
    </Dialog>
  );
}