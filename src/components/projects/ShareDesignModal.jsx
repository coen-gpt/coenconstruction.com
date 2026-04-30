import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Share2, Copy, Check, Download, ExternalLink, Image } from 'lucide-react';
import { appParams } from '@/lib/app-params';

export default function ShareDesignModal({ open, onClose, project }) {
  const [copied, setCopied] = useState(null); // null | 'link' | index

  if (!project) return null;

  const designs = project.ai_designs || [];
  const baseUrl = appParams.appBaseUrl || window.location.origin;
  const shareUrl = `${baseUrl}/shared-design?id=${project.id}`;

  const copyToClipboard = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <Share2 className="w-6 h-6 text-primary" />
            Share Your Designs
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Share project page link */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Project Gallery Link</p>
            <p className="text-xs text-muted-foreground">Share all your AI designs in a beautiful gallery view — anyone with the link can view them.</p>
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="rounded-xl text-xs h-10" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(shareUrl, 'link')}
                className="rounded-xl shrink-0 gap-1.5 h-10 px-4"
              >
                {copied === 'link' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied === 'link' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-primary h-8 px-2 text-xs">
                <ExternalLink className="w-3.5 h-3.5" /> Preview share page
              </Button>
            </a>
          </div>

          {/* Individual design images */}
          {designs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Individual Design Images</p>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{designs.length} design{designs.length > 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {designs.map((design, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl overflow-hidden border border-border bg-muted"
                  >
                    <img src={design.url} alt={`Design ${i + 1}`} className="w-full aspect-[4/3] object-cover" />
                    <div className="p-2 flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-lg h-8 text-xs gap-1"
                        onClick={() => copyToClipboard(design.url, i)}
                      >
                        {copied === i ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        {copied === i ? 'Copied!' : 'Copy URL'}
                      </Button>
                      <a href={design.url} download target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="rounded-lg h-8 px-2">
                          <Download className="w-3 h-3" />
                        </Button>
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {designs.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Image className="w-10 h-10 mx-auto mb-2 opacity-40" />
              No AI designs generated yet. Generate a design first to share it!
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}