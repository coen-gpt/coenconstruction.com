import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, FolderOpen, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function RetrieveProjectsModal({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = async () => {
    if (!email.includes('@')) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await base44.functions.invoke('sendMagicLink', { email: email.trim().toLowerCase() });
      if (res.data?.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(res.data?.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      // The SDK throws on non-2xx — surface the server's message when present
      setStatus('error');
      setErrorMsg(err?.response?.data?.error || 'Something went wrong. Please try again.');
    }
  };

  const handleClose = () => {
    setEmail('');
    setStatus('idle');
    setErrorMsg('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-primary" />
            Retrieve My Projects
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-6 text-center space-y-3"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-heading text-xl">Magic Link Sent!</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Check your inbox at <span className="font-medium text-foreground">{email}</span> for a link to access your projects. It expires in 7 days.
              </p>
              <Button onClick={handleClose} className="rounded-xl w-full mt-4">Done</Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-2">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Enter the email address you used when you started your project. We'll send you a secure magic link to view all your past designs — no password needed.
              </p>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="pl-9 rounded-xl h-12"
                />
              </div>

              {status === 'error' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </motion.div>
              )}

              <Button
                onClick={handleSend}
                disabled={!email.includes('@') || status === 'loading'}
                className="w-full rounded-xl h-12 gap-2"
              >
                {status === 'loading' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending Magic Link…</>
                ) : (
                  <><Mail className="w-4 h-4" /> Send Magic Link</>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}