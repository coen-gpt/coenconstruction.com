import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, DollarSign, Shield, Clock } from "lucide-react";
import { LOCAL_BUSINESS, breadcrumbSchema, faqSchema } from "@/lib/schema";
import DesignPreviewCTA from "@/components/website/DesignPreviewCTA";
import ContactForm from "@/components/website/ContactForm";

const options = [
  { icon: DollarSign, title: "Home Equity Loans", desc: "Leverage the equity in your home to finance your renovation at competitive fixed rates. Great for large projects like home additions and full kitchen remodels." },
  { icon: Shield, title: "HELOC (Home Equity Line of Credit)", desc: "A flexible line of credit secured by your home equity. Draw funds as needed during your project and pay interest only on what you use." },
  { icon: Clock, title: "Personal Loans", desc: "Unsecured loans that don't require home equity. Ideal for smaller projects like custom carpentry, deck construction, or bathroom remodels." },
  { icon: CheckCircle, title: "Construction Loans", desc: "Specialized financing designed for large renovation projects. Funds are released in stages as your project progresses." },
];

export default function WebFinancing() {
  useEffect(() => {
    document.title = "Home Renovation Financing | Coen Construction | Boston MA";
  }, []);

  return (
    <>

      <section className="relative py-28 px-4 flex items-center overflow-hidden">
        <img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1600&q=80" alt="" aria-hidden="true" fetchpriority="high" loading="eager" decoding="sync" width="1600" height="600" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-4xl mx-auto text-center w-full">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">Make It Possible</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-2 mb-5">Financing Your Project</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">Don't let budget be the barrier between you and your dream home. We'll help you explore the best financing options available.</p>
        </div>
      </section>

      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-secondary mb-5">Flexible Options for Every Budget</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              At <Link to="/" className="text-primary hover:underline">Coen Construction</Link>, we believe every Boston homeowner deserves the home of their dreams — regardless of where they're starting. That's why we work with a range of financing partners to help you fund your <Link to="/services/home-additions" className="text-primary hover:underline">home addition</Link>, <Link to="/services/kitchen-remodeling" className="text-primary hover:underline">kitchen remodel</Link>, or deck project.
            </p>
            <p className="text-gray-600 leading-relaxed mb-6">
              We'll walk you through your options at your free consultation and help match you with the right financing approach for your situation. Our goal is a seamless process — from financing to final hammer swing.
            </p>
            <div className="space-y-2">
              {["No pre-payment penalties on most loans", "Competitive interest rates through our lending partners", "Fast approval decisions", "Flexible repayment terms from 12–180 months", "Available for projects $5,000–$500,000+"].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm text-gray-700">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <img src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80" alt="Home renovation financing Boston MA" width="640" height="320" loading="lazy" decoding="async" className="rounded-xl shadow-xl w-full h-80 object-cover" />
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-secondary">Financing Options</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {options.map(o => (
              <div key={o.title} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center shrink-0">
                    <o.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary mb-2">{o.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{o.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <DesignPreviewCTA variant="inline" />
        </div>
      </section>

      <section className="py-16 px-4 bg-muted">
        <div className="max-w-2xl mx-auto bg-white rounded-xl p-8 shadow-sm">
          <ContactForm title="Discuss Financing Options" subtitle="Ask us about financing at your free consultation." />
        </div>
      </section>
    </>
  );
}