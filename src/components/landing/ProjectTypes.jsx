import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home, UtensilsCrossed, Bath, Fence, PlusCircle, PaintBucket, Square } from 'lucide-react';

// Simple roof icon using a triangle-like shape via Square
const TriangleRight = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18 L12 4 L21 18 Z" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const projects = [
  {
    type: 'home_addition',
    label: 'Home Addition',
    icon: Home,
    image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&q=80',
    description: 'Expand your Greater Boston home with a seamless, beautiful addition'
  },
  {
    type: 'kitchen_remodel',
    label: 'Kitchen Remodel',
    icon: UtensilsCrossed,
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
    description: 'Transform the heart of your New England home into a culinary masterpiece'
  },
  {
    type: 'bathroom_remodel',
    label: 'Bathroom Remodel',
    icon: Bath,
    image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&q=80',
    description: 'Create your personal spa retreat with timeless finishes'
  },
  {
    type: 'deck_remodel',
    label: 'Deck & Outdoor Living',
    icon: Fence,
    image: 'https://media.base44.com/images/public/69ceffc373023298f7104eee/bd27b62cd_generated_image.png',
    description: 'Design the perfect outdoor space for New England summers'
  },
  {
    type: 'siding',
    label: 'Siding',
    icon: PaintBucket,
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80',
    description: 'Refresh your home\'s exterior with durable, beautiful New England siding'
  },
  {
    type: 'roofing',
    label: 'Roofing',
    icon: TriangleRight,
    image: 'https://images.unsplash.com/photo-1516156008625-3a9d6067fab5?w=600&q=80',
    description: 'Protect your home with a quality roof built to withstand New England winters'
  },
  {
    type: 'windows_doors',
    label: 'Windows & Doors',
    icon: Square,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    description: 'Upgrade your curb appeal and energy efficiency with new windows & doors'
  },
  {
    type: 'other',
    label: 'Other Project',
    icon: PlusCircle,
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=80',
    description: 'Custom carpentry, painting & more — tell us your vision'
  }
];

export default function ProjectTypes() {
  return (
    <section className="py-24 px-6 bg-background">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-heading font-bold text-sm uppercase tracking-widest mb-3">Our Services</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            What Are You <span className="text-primary">Dreaming</span> Of?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Choose your project type and let Coen Construction's AI design tool bring your vision to life
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {projects.map((project, i) => (
            <motion.div
              key={project.type}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to={`/start?type=${project.type}`}>
                <div className="group relative rounded-md overflow-hidden h-72 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500">
                  <img
                    src={project.image}
                    alt={project.label}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-primary/90 text-primary-foreground">
                        <project.icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-white text-xl font-heading">{project.label}</h3>
                    </div>
                    <p className="text-white/70 text-sm">{project.description}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}