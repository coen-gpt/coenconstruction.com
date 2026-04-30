import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/51f7786bb_COENLogo-white.png"

          alt="Coen Construction" className="h-12 w-auto" />
          
          
          

          
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm text-white/70 hover:text-white transition-colors font-medium">Home</Link>
          <Link to="/my-projects" className="text-sm text-white/70 hover:text-white transition-colors font-medium">My Projects</Link>
          <a href="tel:6178572636" className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors font-medium">
            <Phone className="w-3.5 h-3.5" />
            (617) 857-COEN
          </a>
          <Link to="/start">
            <Button className="rounded-md px-6 bg-primary hover:bg-primary/90 font-semibold tracking-wide">
              Free Design Preview
            </Button>
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-white" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen &&
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-white/10 bg-secondary">
          
            <div className="px-6 py-4 flex flex-col gap-3">
              <Link to="/" className="py-2 text-white/80 font-medium" onClick={() => setMobileOpen(false)}>Home</Link>
              <Link to="/my-projects" className="py-2 text-white/80 font-medium" onClick={() => setMobileOpen(false)}>My Projects</Link>
              <a href="tel:6178572636" className="py-2 text-white/80 font-medium flex items-center gap-2">
                <Phone className="w-4 h-4" /> (617) 857-COEN
              </a>
              <Link to="/start" onClick={() => setMobileOpen(false)}>
                <Button className="w-full rounded-md bg-primary hover:bg-primary/90 font-semibold">Free Design Preview</Button>
              </Link>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </nav>);

}