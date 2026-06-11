import { Link, useLocation } from "react-router-dom";
import { Phone, Sparkles } from "lucide-react";
import { WebsiteEvents } from "@/lib/analytics";

// Routes where the bar would cover the tool's own flow controls
const HIDDEN_PATHS = ["/start"];

/**
 * Sticky bottom call/quote bar — mobile only.
 * Click-to-call converts far better than inline links for local service
 * businesses, and the mobile header otherwise has no always-visible CTA.
 */
export default function MobileStickyCTA() {
  const { pathname } = useLocation();
  if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-2 gap-2 p-2">
        <a
          href="tel:6178572636"
          onClick={() => WebsiteEvents.phoneClicked("mobile_sticky_bar")}
          className="flex items-center justify-center gap-2 bg-secondary text-white font-bold py-3 rounded text-sm"
        >
          <Phone className="w-4 h-4" /> Call Now
        </a>
        <Link
          to="/start"
          onClick={() => WebsiteEvents.designPreviewCTAClicked("mobile_sticky_bar", pathname)}
          className="flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded text-sm"
        >
          <Sparkles className="w-4 h-4" /> Free Design Preview
        </Link>
      </div>
    </div>
  );
}
