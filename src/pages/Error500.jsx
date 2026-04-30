import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Home, Phone, RefreshCw } from "lucide-react";

export default function Error500() {
  return (
    <>
      <Helmet>
        <title>Something Went Wrong | Coen Construction</title>
        <meta name="description" content="We're experiencing a temporary issue. Please try again shortly or contact Coen Construction directly." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header strip */}
        <div className="bg-secondary px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-white font-bold text-lg">Coen Construction</span>
          </Link>
        </div>

        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-lg w-full text-center">
            {/* 500 visual */}
            <div className="mb-8">
              <div className="text-8xl font-bold text-primary/20 leading-none">500</div>
              <div className="w-16 h-1 bg-primary mx-auto mt-2 mb-6 rounded"></div>
              <h1 className="text-3xl md:text-4xl font-bold text-secondary mb-3">
                Something Went Wrong
              </h1>
              <p className="text-gray-600 text-lg leading-relaxed">
                We hit an unexpected snag on our end — just like an unforeseen issue on a job site.
                Our team has been notified and is working on a fix.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 justify-center mb-10">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-5 py-3 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-secondary text-white font-semibold px-5 py-3 rounded-lg hover:bg-secondary/90 transition-colors"
              >
                <Home className="w-4 h-4" /> Go to Homepage
              </Link>
            </div>

            {/* Contact fallback */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-left">
              <p className="text-sm font-bold text-secondary uppercase tracking-widest mb-3">Need Immediate Help?</p>
              <p className="text-gray-600 text-sm mb-4">
                If the problem persists, please reach out to us directly. We're happy to help.
              </p>
              <div className="space-y-2">
                <a href="tel:+16178572636" className="flex items-center gap-2 text-primary font-semibold hover:underline">
                  <Phone className="w-4 h-4" /> (617) 857-COEN
                </a>
                <a href="mailto:info@coenconstruction.com" className="flex items-center gap-2 text-primary font-semibold hover:underline">
                  info@coenconstruction.com
                </a>
              </div>
            </div>
          </div>
        </main>

        <div className="bg-secondary/5 border-t border-gray-200 px-6 py-4 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Coen Construction — Greater Boston General Contractor
        </div>
      </div>
    </>
  );
}