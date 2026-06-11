import React from 'react';
import { Phone, MapPin, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-secondary text-white">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <img
              src="https://media.base44.com/images/public/69ceffc373023298f7104eee/bb1ddefb6_coen_logo_ads.png"
              alt="Coen Construction"
              className="h-10 w-10 object-contain"
            />
            <span className="font-heading text-lg font-bold tracking-wide">Coen Construction</span>
          </div>
          <p className="text-white/55 text-sm leading-relaxed">
            Family-owned general contractor serving Greater Boston since 2010. We design and build
            with the finest products for long-lasting results.
          </p>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-heading font-bold text-sm uppercase tracking-widest text-primary mb-4">Contact Us</h4>
          <ul className="space-y-3 text-sm text-white/70">
            <li>
              <a href="tel:6178572636" className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="w-4 h-4 text-primary" /> (617) 857-COEN
              </a>
            </li>
            <li>
              <a href="mailto:info@coenconstruction.com" className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="w-4 h-4 text-primary" /> info@coenconstruction.com
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              387 Page Street Ste 10B, Stoughton, MA 02072
            </li>
          </ul>
        </div>

        {/* Links */}
        <div>
          <h4 className="font-heading font-bold text-sm uppercase tracking-widest text-primary mb-4">Quick Links</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
            <li><Link to="/start" className="hover:text-white transition-colors">Start a Design</Link></li>
            <li><Link to="/my-projects" className="hover:text-white transition-colors">My Projects</Link></li>
            <li><a href="https://coenconstruction.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Our Full Website</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 px-6 text-center text-white/35 text-xs">
        © {new Date().getFullYear()} Coen Construction. All rights reserved. · Greater Boston, MA
      </div>
    </footer>
  );
}