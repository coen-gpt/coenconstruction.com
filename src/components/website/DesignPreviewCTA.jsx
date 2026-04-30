import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

export default function DesignPreviewCTA({ variant = "banner" }) {
  if (variant === "inline") {
    return (
      <div className="bg-gradient-to-r from-secondary to-secondary/90 rounded-xl p-6 text-white flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-primary font-semibold text-sm uppercase tracking-wide">Free Tool</span>
          </div>
          <h3 className="text-xl font-bold mb-1">Visualize Your Project Before You Build</h3>
          <p className="text-white/80 text-sm">Upload a photo of your home and see AI-powered renovation concepts instantly. No commitment required.</p>
        </div>
        <Link to="/start" className="shrink-0 bg-primary text-white font-bold px-6 py-3 rounded flex items-center gap-2 hover:bg-primary/90 transition-colors whitespace-nowrap">
          Try Free Preview <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="bg-white border-2 border-primary/20 rounded-xl p-6 text-center shadow-lg">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-secondary mb-2">See It Before You Build It</h3>
        <p className="text-gray-600 text-sm mb-4">Our free AI Design Preview tool lets you visualize any renovation or addition on your actual home.</p>
        <Link to="/start" className="block bg-primary text-white font-bold py-3 rounded hover:bg-primary/90 transition-colors">
          Start Free Preview →
        </Link>
      </div>
    );
  }

  // banner variant (default)
  return (
    <section className="bg-gradient-to-br from-secondary via-secondary to-secondary/95 py-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-primary/20 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <Sparkles className="w-4 h-4" /> Free Tool — No Obligation
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          See Your Dream Home <span className="text-primary">Before the First Nail</span>
        </h2>
        <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
          Upload a photo of your home and our AI instantly shows you what your renovation, addition, or new deck could look like. It's free, fast, and incredibly powerful.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/start" className="bg-primary text-white font-bold px-10 py-4 rounded text-lg hover:bg-primary/90 transition-colors flex items-center gap-2 justify-center">
            <Sparkles className="w-5 h-5" /> Try Free Design Preview
          </Link>
          <a href="tel:6178572636" className="border-2 border-white text-white font-bold px-8 py-4 rounded text-lg hover:bg-white/10 transition-colors">
            Call (617) 857-COEN
          </a>
        </div>
      </div>
    </section>
  );
}