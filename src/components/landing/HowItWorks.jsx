import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Upload, Sparkles, ThumbsUp } from 'lucide-react';

const steps = [
  {
    icon: ClipboardList,
    title: 'Tell Us Your Vision',
    description: 'Fill out a quick form with your project details, preferences, and budget range.'
  },
  {
    icon: Upload,
    title: 'Upload Your Photos',
    description: 'Share photos of your current space and any inspiration images you love.'
  },
  {
    icon: Sparkles,
    title: 'AI Generates Designs',
    description: 'Our AI assistant creates concept sketches based on your vision and photos.'
  },
  {
    icon: ThumbsUp,
    title: 'Love It? Let\'s Build!',
    description: 'Review your designs and connect with our team to make it reality.'
  }
];

export default function HowItWorks() {
  return (
    <section className="py-24 px-6 bg-secondary text-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-heading font-bold text-sm uppercase tracking-widest mb-3">Simple Process</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4 text-white">
            How It <span className="text-primary">Works</span>
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Four simple steps to visualize your Greater Boston home project
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <step.icon className="w-9 h-9 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </div>
              </div>
              <h3 className="font-heading text-lg font-bold mb-2 text-white">{step.title}</h3>
              <p className="text-white/55 text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}