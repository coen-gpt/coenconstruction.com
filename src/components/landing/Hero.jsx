import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Phone, Shield, Star, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import RetrieveProjectsModal from './RetrieveProjectsModal';

export default function Hero() {
  const [retrieveOpen, setRetrieveOpen] = useState(false);

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background — New England suburban home */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://media.base44.com/images/public/69ceffc373023298f7104eee/08ae347c4_homebuildersboston-1920w.png"
          alt="New England home"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/80 to-secondary/30" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-heading text-4xl md:text-5xl lg:text-6xl text-white font-bold leading-tight mb-4"
          >
            See Your Greater Boston Home{' '}
            <span className="text-primary">Transformed</span>{' '}
            Before We Break Ground
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-base md:text-lg text-white/75 mb-10 leading-relaxed"
          >
            Upload photos of your current space, describe your vision, and our AI will generate
            realistic design concepts — kitchens, additions, decks & more. Trusted by homeowners
            across Greater Boston since 2010.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Link to="/start">
              <Button size="lg" className="text-base px-8 py-6 rounded-md gap-2 font-bold tracking-wide shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90">
                Start Your Free Design
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setRetrieveOpen(true)}
              className="text-base px-8 py-6 rounded-md gap-2 bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm font-semibold"
            >
              <FolderOpen className="w-5 h-5" />
              Retrieve My Projects
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="flex flex-wrap items-center gap-6 mt-12 text-white/60 text-sm"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Free AI Design Preview
            </div>
            <div className="w-1 h-1 rounded-full bg-white/30" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              No Obligation Quote
            </div>
            <div className="w-1 h-1 rounded-full bg-white/30" />
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Serving Greater Boston Since 2010
            </div>
            <div className="w-1 h-1 rounded-full bg-white/30" />
            <a href="tel:6178572636" className="flex items-center gap-2 hover:text-white transition-colors">
              <Phone className="w-4 h-4 text-primary" />
              (617) 857-COEN
            </a>
          </motion.div>
        </div>
      </div>

      <RetrieveProjectsModal open={retrieveOpen} onClose={() => setRetrieveOpen(false)} />
    </section>
  );
}