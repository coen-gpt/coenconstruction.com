import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

// Projects are retrieved via an emailed magic link — never shown directly from
// a typed-in email, which would let anyone view any customer's designs.
export default function RetrieveProjectsModal({ open, onOpenChange }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleRetrieve = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await base44.functions.invoke('sendMagicLink', { email: email.trim().toLowerCase() });
      if (res.data?.success) {
        setSent(true);
      } else {
        setError(res.data?.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next) => {
    if (!next) {
      setEmail('');
      setSent(false);
      setError('');
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retrieve My Projects</DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-4 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="font-heading text-lg">Magic Link Sent!</h3>
            <p className="text-sm text-muted-foreground">
              Check your inbox at <span className="font-medium text-foreground">{email}</span> for a secure link to your projects. It expires in 7 days.
            </p>
            <Button onClick={() => handleOpenChange(false)} className="w-full rounded-lg mt-2">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleRetrieve} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the email address you used when creating your project and we&apos;ll email you a secure link to view your designs and renderings.
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
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Email Me My Projects
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
