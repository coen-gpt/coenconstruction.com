import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, CheckCircle2, Loader2, Home, FileText, Image, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';

export default function SendDesignModal({ open, onClose, project, onSent }) {
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('');

  if (!project) return null;

  const hasDesigns = (project.ai_designs || []).length > 0;
  const hasBeforePhotos = (project.before_photos || []).length > 0;
  const hasInspirationPhotos = (project.inspiration_photos || []).length > 0;

  const handleSend = async () => {
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await base44.functions.invoke('sendDesignToAdmin', {
        projectId: project.id,
        userEmail: project.email?.toLowerCase(),
        userName: project.full_name,
        userPhone: project.phone,
        userAddress: project.address,
        projectType: project.project_type,
        aiDesigns: project.ai_designs || [],
        budgetRange: project.budget_range,
      });
      if (res.data?.success) {
        setStatus('success');
        onSent?.();
      } else {
        setStatus('error');
        setErrorMsg(res.data?.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.error || 'Failed to send design. Please try again.');
    }
  };

  const handleClose = () => {
    if (status !== 'sending') {
      setStatus('idle');
      setErrorMsg('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Send Design to Coen Construction
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-6 gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold mb-1">Design Package Sent!</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The Coen Construction team has received your full design package and will be in touch shortly to schedule your on-site meeting.
                </p>
              </div>
              <Button onClick={handleClose} className="px-8 rounded-xl">Done</Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                This will send your complete project package to the Coen Construction team — they'll review your details and reach out to schedule a <strong>free on-site meeting</strong>.
              </p>

              {/* What's included */}
              <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">What's included</p>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span>Contact info & project description</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Home className="w-4 h-4 text-primary shrink-0" />
                  <span>Property address & budget range</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Image className="w-4 h-4 text-primary shrink-0" />
                  <span>Before & inspiration photos {!hasBeforePhotos && !hasInspirationPhotos ? <span className="text-muted-foreground">(none uploaded)</span> : ''}</span>
                  {(hasBeforePhotos || hasInspirationPhotos) && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <span>AI design renderings {!hasDesigns ? <span className="text-muted-foreground">(none generated yet)</span> : `(${project.ai_designs.length})`}</span>
                  {hasDesigns && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />}
                </div>
                <div className="border-t border-border pt-2 mt-1 flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-4 h-4 text-secondary shrink-0" />
                  <span>Formatted PDF lead package (attached)</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />
                </div>
              </div>

              {status === 'error' && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">{errorMsg}</p>
              )}

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={handleClose} className="flex-1 rounded-xl" disabled={status === 'sending'}>
                  Cancel
                </Button>
                <Button onClick={handleSend} className="flex-1 rounded-xl gap-2" disabled={status === 'sending'}>
                  {status === 'sending' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send to Coen</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}