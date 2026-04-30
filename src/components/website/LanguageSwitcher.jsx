/**
 * LanguageSwitcher — accessible language selector for the website.
 *
 * Renders as a compact dropdown with flag + label.
 * Only visible when more than one language is configured in LANGUAGES.
 */

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { ACTIVE_LANGUAGES } from "@/lib/i18n";

export default function LanguageSwitcher({ className = "" }) {
  const { currentLang, switchLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Only show if multiple languages are active
  if (ACTIVE_LANGUAGES.length <= 1) return null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        aria-label={`Current language: ${currentLang.label}. Click to change language.`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-secondary transition-colors px-2 py-1.5 rounded-md hover:bg-gray-100"
      >
        <Globe className="w-4 h-4" aria-hidden="true" />
        <span aria-hidden="true">{currentLang.flag}</span>
        <span className="hidden sm:inline">{currentLang.nativeLabel}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M6 8L1 3h10z" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
        >
          {ACTIVE_LANGUAGES.map(lang => (
            <li key={lang.hreflang} role="option" aria-selected={lang.hreflang === currentLang.hreflang}>
              <button
                onClick={() => { switchLanguage(lang); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left ${
                  lang.hreflang === currentLang.hreflang
                    ? "text-primary font-semibold bg-primary/5"
                    : "text-gray-700"
                }`}
                lang={lang.code}
              >
                <span aria-hidden="true">{lang.flag}</span>
                <span>{lang.nativeLabel}</span>
                {lang.hreflang === currentLang.hreflang && (
                  <span className="ml-auto text-primary" aria-hidden="true">✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}