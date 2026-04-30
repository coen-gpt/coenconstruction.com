import { Link } from "react-router-dom";
import { RotateCw } from "lucide-react";
import { useEffect } from "react";
import RegionsStrip from "@/components/website/RegionsStrip";
import { LOCAL_BUSINESS, breadcrumbSchema } from "@/lib/schema";
import { useState } from "react";
import DesignPreviewCTA from "@/components/website/DesignPreviewCTA";
import Testimonials from "@/components/website/Testimonials";
import ContactForm from "@/components/website/ContactForm";

const projects = [
  { title: "Siding & Curb Appeal Transformation", category: "Siding", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/0c8a7bbe5_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/d256d05e0_generated_image.png", location: "Newton, MA" },
  { title: "Deck Reconstruction & Pergola", category: "Decks & Porches", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/639fd24a7_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/290ca7a7c_generated_image.png", location: "Cambridge, MA" },
  { title: "Kitchen Modernization", category: "Kitchen", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/6c1dba1ba_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/65a2304c6_generated_image.png", location: "Brookline, MA" },
  { title: "Master Bathroom Remodel", category: "Bathroom", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/324b6a6b6_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/c1742d9d5_generated_image.png", location: "Medford, MA" },
  { title: "Premium Siding Installation", category: "Siding", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/0a5cb4618_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/1c1aabf59_generated_image.png", location: "Waltham, MA" },
  { title: "Second-Story Addition", category: "Addition", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/65056a567_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/3bbdbb657_generated_image.png", location: "Somerville, MA" },
  { title: "Guest Bathroom Transformation", category: "Bathroom", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/9b3b83d4d_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/7fe477070_generated_image.png", location: "Arlington, MA" },
  { title: "Cape Cod Kitchen Expansion", category: "Kitchen", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/7da6a0d70_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/29ab37f9e_generated_image.png", location: "Belmont, MA" },
  { title: "Master Suite Bedroom Addition", category: "Addition", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/143551b5c_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/6fa3055df_generated_image.png", location: "Watertown, MA" },
  { title: "Colonial Porch Replacement", category: "Decks & Porches", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/863f7c68a_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/f28498546_generated_image.png", location: "Lexington, MA" },
  { title: "Basement Finishing Project", category: "Addition", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/2d020345e_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/090e7d6c0_generated_image.png", location: "Quincy, MA" },
  { title: "Entryway & Foyer Remodel", category: "Remodeling", before: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/33abc4a3d_generated_image.png", after: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/262d94ee0_generated_image.png", location: "Milton, MA" },
];

const cats = ["All", "Addition", "Siding", "Decks & Porches", "Kitchen", "Bathroom", "Remodeling"];

export default function WebGallery() {
  const [active, setActive] = useState("All");
  const [toggles, setToggles] = useState({});
  useEffect(() => { document.title = "Portfolio | Coen Construction | Boston MA Before & After Projects"; }, []);

  const filtered = active === "All" ? projects : projects.filter(p => p.category === active);

  const toggleBeforeAfter = (index) => {
    setToggles(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <>

      <section className="relative py-28 px-4 flex items-center overflow-hidden">
        <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=80" alt="" aria-hidden="true" fetchpriority="high" loading="eager" decoding="sync" width="1600" height="600" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-4xl mx-auto text-center w-full">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">Portfolio</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-2 mb-5">Our Work</h1>
          <p className="text-white/80 text-lg">Hundreds of completed projects across Greater Boston. Click any project to see the before and after transformation.</p>
        </div>
      </section>

      <section className="py-8 px-4 bg-muted">
        <div className="max-w-7xl mx-auto">
          <DesignPreviewCTA variant="inline" />
        </div>
      </section>

      <section className="py-14 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-10 justify-center">
            {cats.map(c => (
              <button key={c} onClick={() => setActive(c)} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${active === c ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"}`}>
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p, i) => {
              const showAfter = toggles[i];
              return (
                <div key={i} className="group rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
                  <div className="relative h-52 overflow-hidden bg-gray-100">
                    <img 
                      src={showAfter ? p.after : p.before} 
                      alt={`${p.title} ${showAfter ? 'After' : 'Before'} — Coen Construction`} 
                      width="600" 
                      height="400" 
                      loading={i < 6 ? "eager" : "lazy"}
                      decoding="async" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded">{p.category}</span>
                    </div>
                    <button 
                      onClick={() => toggleBeforeAfter(i)}
                      className="absolute bottom-3 right-3 bg-white text-secondary hover:bg-primary hover:text-white font-semibold px-3 py-2 rounded flex items-center gap-1.5 transition-colors text-xs shadow-md"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      {showAfter ? "Before" : "After"}
                    </button>
                    {/* Label: Before/After */}
                    <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded">
                      {showAfter ? "AFTER" : "BEFORE"}
                    </div>
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold text-secondary text-sm mb-1">{p.title}</h2>
                    <p className="text-gray-400 text-xs">{p.location}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-500 mb-4">Ready to start your own project?</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/start" className="bg-primary text-white font-bold px-8 py-3 rounded hover:bg-primary/90 transition-colors">Try Free Design Preview</Link>
              <Link to="/contact" className="border-2 border-secondary text-secondary font-bold px-8 py-3 rounded hover:bg-secondary hover:text-white transition-colors">Get Free Estimate</Link>
            </div>
          </div>
        </div>
      </section>

      <RegionsStrip bg="muted" />

      <section className="py-16 px-4 bg-white">
        <div className="max-w-2xl mx-auto bg-muted rounded-xl shadow-sm p-8">
          <ContactForm title="Start Your Project" subtitle="Tell us about your vision and we'll provide a free estimate." />
        </div>
      </section>
      </>
      );
      }