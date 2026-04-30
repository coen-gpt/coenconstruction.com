import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAllSiteContent, useSaveContent } from "@/hooks/useSiteContent";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, RefreshCw, Check, Globe, Edit3, Image, FileText, Zap,
  Save, ChevronDown, ChevronRight, Layout, Columns, Type, Phone,
  Star, MapPin, Menu, AlignLeft, Home, Info, Mail, Wrench, Eye, Tag,
  X, PanelLeftClose, PanelLeft, BarChart3, ExternalLink, TrendingUp, Monitor, ArrowRight, Code
} from "lucide-react";
import { Link } from "react-router-dom";
import MetaTagsEditor from "@/components/admin/MetaTagsEditor";

// ─── Default content ─────────────────────────────────────────────────────────
const DEFAULT_CONTENT = {
  navbar: {
    top_bar_text: "Serving Greater Boston Since 2010 | Licensed & Insured",
    phone: "6178572636",
    cta_primary_label: "Free Design Preview",
    cta_secondary_label: "Contact Us",
  },
  footer: {
    tagline: "Boston's trusted general contractors since 2010. Family-owned, precision-built, and committed to your vision.",
    address: "387 Page Street Ste 10B\nStoughton, MA 02072",
    phone: "6178572636",
    email: "info@coenconstruction.com",
    cta_headline: "Ready to Transform Your Home?",
    cta_subtext: "Try our Free AI Design Preview tool and see your renovation before it begins.",
    copyright: `© ${new Date().getFullYear()} Coen Construction. All Rights Reserved. | Licensed & Insured | MA Contractor Reg. #CS-107247`,
    instagram_url: "https://www.instagram.com/coenconstruction",
    angi_url: "https://www.angi.com/write-review/11070437",
  },
  home_hero: {
    badge: "Boston's #1 Rated General Contractor",
    headline: "Building Services Across Greater Boston",
    subtext: "We design and build with the finest products for long-lasting results. Family-owned since 2010, Coen Construction is the Boston MA general contractor residents trust.",
    cta_primary: "Book A Consultation",
    cta_secondary: "Free Design Preview",
    bg_image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1600&q=80",
  },
  home_stats: {
    stat1_val: "15+", stat1_label: "Years in Business",
    stat2_val: "500+", stat2_label: "Projects Completed",
    stat3_val: "5★", stat3_label: "Average Rating",
    stat4_val: "100%", stat4_label: "Licensed & Insured",
  },
  home_intro: {
    badge: "Boston's Trusted Contractor",
    headline: "Your Vision, Our Expertise",
    paragraph1: "Your house is your most precious asset; cooperating with the right Boston MA general contractor guarantees that each renovation improves its beauty, use, and value.",
    paragraph2: "Whether you need home additions in Boston, custom deck construction, or a full-scale makeover, we're here to deliver seamless, stress-free results.",
    feature1: "Free in-home estimates",
    feature2: "Licensed & fully insured",
    feature3: "Transparent pricing — no surprises",
    feature4: "Quality materials, lasting results",
    image_url: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/f9008aaf4_home_builders_boston-1920w.png",
    years_badge: "15+",
  },
  home_cta: {
    headline: "Ready To Begin Your Project?",
    subtext: "Contact us today for a free, no-obligation estimate. Our team will work with you to understand your goals and provide honest, professional guidance every step of the way.",
  },
  about_hero: {
    badge: "Our Story",
    headline: "About Coen Construction",
    subtext: "Building Better Homes With Precision And Passion — serving Greater Boston since 2010.",
    bg_image: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/96f155d30_generated_image.png",
  },
  about_main: {
    badge: "Family-Owned Since 2010",
    headline: "Dedicated to Exceptional Craftsmanship",
    paragraph1: "Coen Construction is committed to providing professional building and great service around Metro West and South Shore.",
    paragraph2: "We specialize in residential improvements, including decks, porches, pergolas, house expansions, doors, windows, and siding.",
    paragraph3: "In addition to exterior work, we do whole-house renovation projects.",
    feature1: "Licensed & fully insured in Massachusetts",
    feature2: "Family-owned and operated since 2010",
    feature3: "Transparent pricing with detailed proposals",
    feature4: "High-quality materials with lasting results",
    feature5: "Professional snow removal across Greater Boston",
    image_url: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/7a0faf8b7_generated_image.png",
  },
  about_values: {
    headline: "Why Boston Homeowners Choose Us",
    value1_title: "Quality First",
    value1_desc: "We use only premium materials and proven construction techniques.",
    value2_title: "Customer-Centered",
    value2_desc: "Every project begins with listening. We take time to understand your vision.",
    value3_title: "Seamless Results",
    value3_desc: "Every addition or renovation is designed to blend perfectly with your existing home.",
  },
  contact_hero: {
    badge: "Get In Touch",
    headline: "Contact Us",
    subtext: "Expert Craftsmanship Starts With A Conversation",
  },
  contact_info: {
    headline: "Let's Talk About Your Project",
    intro_text: "Are you ready to begin your next house renovation task? Coen Construction is here to assist you.",
    hours: "Mon–Fri 7am–6pm | Sat 8am–2pm",
    note: "We'll gladly arrange a time to evaluate your space and provide a free estimate — no pressure, no obligation.",
  },
  gallery_page: {
    headline: "Our Work",
    subtext: "Browse photos from our completed projects across Greater Boston.",
    badge: "Portfolio",
  },
  financing_hero: {
    badge: "Flexible Financing",
    headline: "Make Your Dream Project Affordable",
    subtext: "We partner with leading lenders to help Greater Boston homeowners finance their renovation projects.",
  },
  financing_options: {
    option1_title: "Home Improvement Loans",
    option1_desc: "Unsecured personal loans with competitive rates. Quick approval, no home equity required.",
    option2_title: "Home Equity Line of Credit",
    option2_desc: "Leverage your home's equity for larger projects with lower interest rates.",
    option3_title: "Construction Loans",
    option3_desc: "Short-term financing designed specifically for major renovation and addition projects.",
    cta_headline: "Ready to Get Financing?",
    cta_subtext: "Contact us and we'll connect you with our trusted lending partners.",
  },
  service_areas_page: {
    headline: "Serving 65+ Greater Boston Communities",
    subtext: "From the South Shore to the MetroWest corridor, Coen Construction brings expert craftsmanship to homeowners across Greater Boston.",
    badge: "Service Areas",
    cta_headline: "Is Your Town on the List?",
    cta_subtext: "We serve most communities within 35 miles of Boston. Contact us to confirm service in your area.",
  },
  blog_listing: {
    headline: "Construction Tips & Guides",
    subtext: "Expert advice for Greater Boston homeowners — from project planning to material selection.",
    badge: "The Coen Blog",
  },
  start_page: {
    headline: "Start Your Dream Project",
    subtext: "Tell us about your project and get an AI-generated design concept in minutes.",
    badge: "Free Design Preview",
    step1_label: "Describe Your Project",
    step2_label: "Upload Photos",
    step3_label: "Get AI Design",
    cta_label: "Get My Free Design",
  },
  budget_estimator: {
    headline: "Free Budget Estimator",
    subtext: "Get a ballpark estimate for your renovation project in under 2 minutes.",
    badge: "Instant Estimate",
  },
  exit_intent: {
    headline: "",
    subtext: "",
    offer_badge: "10% Off Your First Project",
    button_label: "Claim My 10% Discount",
    campaign_name: "Exit Intent Popup",
    disclaimer_text: "",
    disclaimer_link_label: "Terms & Conditions",
    terms_and_conditions: "",
    image_url: "",
  },
  service_home_additions: {
    headline: "Transform Your Living Space With Home Additions in Boston",
    intro: "Home additions Boston offers the perfect approach to get more space, improve utility, and increase the value of your home.",
    body1: "Coen Construction specializes in building and planning seamless home expansions.",
    body2: "Our workmanship brings your vision to life with accuracy and care.",
    body3: "Coen Construction stresses custom woodwork, structural upgrades, and energy-efficient solutions.",
    feature1: "Bedroom additions & suites", feature2: "Second-story additions", feature3: "Sunrooms & four-season rooms", feature4: "Family room expansions",
    feature5: "Dormer additions", feature6: "Kitchen expansions", feature7: "Basement finishing", feature8: "In-law suites",
    image_url: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/07dc013df_generated_image.png",
    meta_title: "Home Additions Boston MA", meta_description: "Coen Construction specializes in home additions across Boston MA. Add square footage, bedroom suites, sunrooms, and more. Free estimates.",
  },
  service_decks: {
    headline: "Build The Perfect Outdoor Retreat With Boston MA General Contractors",
    intro: "Coen Construction helps homeowners convert their backyards into useful, enjoyable retreats.",
    body1: "As trusted Boston MA general contractors, we design and build decks, porches, and Boston pergolas.",
    body2: "A deck may be the ideal outdoor meeting place for summer barbecues or morning coffee.",
    body3: "Pergolas create detail and shade, accentuating the uniqueness of your garden.",
    feature1: "Custom wood & composite decks", feature2: "Wraparound porches", feature3: "Screened-in porches", feature4: "Pergolas & arbors",
    feature5: "Gazebos", feature6: "Outdoor kitchens", feature7: "Built-in seating", feature8: "Lighting & electrical",
    image_url: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/219f371d9_generated_image.png",
    meta_title: "Decks, Porches & Pergolas Boston MA", meta_description: "Custom decks, porches, and pergolas in Boston MA by Coen Construction.",
  },
  service_siding: {
    headline: "Premium Siding Installation by Boston MA Siding Contractors",
    intro: "The right siding protects your home from New England's harsh winters.",
    body1: "We work with all major siding materials including vinyl, James Hardie fiber cement, cedar, and engineered wood.",
    body2: "Our siding projects include full re-siding, partial replacement, repair, and trim work.",
    body3: "As licensed siding contractors in Boston MA, we're committed to clean, precise installations.",
    feature1: "Vinyl siding", feature2: "James Hardie fiber cement", feature3: "Cedar & wood siding", feature4: "Engineered wood siding",
    feature5: "Trim & fascia work", feature6: "Siding repair & replacement", feature7: "Window & door installation", feature8: "Full exterior makeovers",
    image_url: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/8ae785e3e_generated_image.png",
    meta_title: "Siding Contractors Boston MA", meta_description: "Coen Construction are the leading siding contractors in Boston MA.",
  },
  service_kitchen: {
    headline: "Expert Kitchen Remodeling Boston Homeowners Love",
    intro: "A thoughtfully designed kitchen remodel can transform daily routines and increase home value.",
    body1: "Coen Construction brings years of kitchen remodeling experience to Boston and surrounding communities.",
    body2: "Whether you're opening up a closed-off galley kitchen or doing a full gut renovation, our team works with you.",
    body3: "Our kitchen remodeling projects in Boston are built to last.",
    feature1: "Custom cabinet design & installation", feature2: "Quartz & granite countertops", feature3: "Kitchen island additions", feature4: "Open-concept conversions",
    feature5: "Lighting design", feature6: "Tile backsplash", feature7: "Plumbing & electrical", feature8: "Flooring installation",
    image_url: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/68b8020a4_generated_image.png",
    meta_title: "Kitchen Remodeling Boston MA", meta_description: "Kitchen remodeling in Boston MA by Coen Construction.",
  },
  service_bathroom: {
    headline: "Expert Bathroom Remodeling Boston Homeowners Trust",
    intro: "Your bathroom is a personal sanctuary. A thoughtfully designed bathroom remodel can transform daily routines and increase home value.",
    body1: "Coen Construction brings years of bathroom remodeling experience to Boston and surrounding communities.",
    body2: "Whether you're updating a master bath with a luxurious soaking tub or refreshing a guest bathroom, our team works with you.",
    body3: "Our bathroom remodeling projects in Boston are built to last.",
    feature1: "Custom vanity design & installation", feature2: "Tile & stone work (showers, floors, accents)", feature3: "Quartz & marble countertops", feature4: "Spa-style soaking tubs & walk-in showers",
    feature5: "Lighting design & ventilation", feature6: "Plumbing & electrical", feature7: "Heated floors & towel racks", feature8: "ADA-accessible bathrooms",
    image_url: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1600&q=80",
    meta_title: "Bathroom Remodeling Boston MA", meta_description: "Bathroom remodeling in Boston MA by Coen Construction.",
  },
  service_carpentry: {
    headline: "Bespoke Custom Carpentry Services in Boston, MA",
    intro: "Fine carpentry is the art that turns a house into a home.",
    body1: "Founded in 2010, Coen Construction is a family business dedicated to the art and craft of fine carpentry.",
    body2: "Our carpenters in Boston MA specialize in custom built-ins, coffered ceilings, wainscoting, crown molding.",
    body3: "Every piece is custom-made and fitted by hand.",
    feature1: "Built-in bookshelves & cabinetry", feature2: "Crown molding & trim", feature3: "Wainscoting & board-and-batten", feature4: "Coffered ceilings",
    feature5: "Staircase refinishing", feature6: "Window seats & benches", feature7: "Custom doors & frames", feature8: "Finish carpentry",
    image_url: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/7fc1d2c27_generated_image.png",
    meta_title: "Custom Carpentry Boston MA", meta_description: "Coen Construction offers expert custom carpentry services in Boston MA.",
  },
  service_snow: {
    headline: "Reliable Snow Removal Services Across Greater Boston",
    intro: "Coen Construction provides dependable, professional snow removal services across Greater Boston.",
    body1: "Our snow removal team is available 24/7 during winter storms.",
    body2: "Services include plowing, salting, ice management, and roof snow removal.",
    body3: "We serve homeowners and businesses across Boston and all surrounding communities.",
    feature1: "Residential driveway plowing", feature2: "Walkway & stair clearing", feature3: "Salting & ice management", feature4: "Commercial parking lot clearing",
    feature5: "Roof snow removal", feature6: "Seasonal & per-event contracts", feature7: "24/7 storm response", feature8: "Greater Boston coverage",
    image_url: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/1162ef136_generated_image.png",
    meta_title: "Snow Removal Boston MA", meta_description: "Professional snow removal in Boston MA by Coen Construction.",
  },
};

// ─── Section Registry ─────────────────────────────────────────────────────────
const SECTIONS = [
  {
    group: "Global",
    icon: Layout,
    items: [
      { key: "navbar", label: "Header / Navbar", icon: Menu, fields: [
        { name: "top_bar_text", label: "Top Bar Text", type: "text" },
        { name: "phone", label: "Phone Number", type: "text" },
        { name: "cta_primary_label", label: "Primary CTA Label", type: "text" },
        { name: "cta_secondary_label", label: "Secondary CTA Label", type: "text" },
      ]},
      { key: "footer", label: "Footer", icon: AlignLeft, fields: [
        { name: "tagline", label: "Brand Tagline", type: "textarea" },
        { name: "address", label: "Address", type: "textarea" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "email", label: "Email", type: "text" },
        { name: "cta_headline", label: "Footer CTA Headline", type: "text" },
        { name: "cta_subtext", label: "Footer CTA Subtext", type: "textarea" },
        { name: "copyright", label: "Copyright Text", type: "text" },
        { name: "instagram_url", label: "Instagram URL", type: "text" },
        { name: "angi_url", label: "Angi URL", type: "text" },
      ]},
    ],
  },
  {
    group: "Home Page",
    icon: Home,
    path: "/",
    items: [
      { key: "home_hero", label: "Hero Section", icon: Star, path: "/", fields: [
        { name: "badge", label: "Badge Text", type: "text" },
        { name: "headline", label: "Main Headline", type: "textarea" },
        { name: "subtext", label: "Subtext / Description", type: "textarea" },
        { name: "cta_primary", label: "Primary CTA", type: "text" },
        { name: "cta_secondary", label: "Secondary CTA", type: "text" },
        { name: "bg_image", label: "Background Image URL", type: "text" },
      ]},
      { key: "home_stats", label: "Stats Bar", icon: Star, path: "/", fields: [
        { name: "stat1_val", label: "Stat 1 Value", type: "text" },
        { name: "stat1_label", label: "Stat 1 Label", type: "text" },
        { name: "stat2_val", label: "Stat 2 Value", type: "text" },
        { name: "stat2_label", label: "Stat 2 Label", type: "text" },
        { name: "stat3_val", label: "Stat 3 Value", type: "text" },
        { name: "stat3_label", label: "Stat 3 Label", type: "text" },
        { name: "stat4_val", label: "Stat 4 Value", type: "text" },
        { name: "stat4_label", label: "Stat 4 Label", type: "text" },
      ]},
      { key: "home_intro", label: "Intro / About Section", icon: Type, path: "/", fields: [
        { name: "badge", label: "Badge Label", type: "text" },
        { name: "headline", label: "Headline", type: "text" },
        { name: "paragraph1", label: "Paragraph 1", type: "textarea" },
        { name: "paragraph2", label: "Paragraph 2", type: "textarea" },
        { name: "feature1", label: "Feature 1", type: "text" },
        { name: "feature2", label: "Feature 2", type: "text" },
        { name: "feature3", label: "Feature 3", type: "text" },
        { name: "feature4", label: "Feature 4", type: "text" },
        { name: "image_url", label: "Side Image URL", type: "text" },
        { name: "years_badge", label: "Years Badge Text", type: "text" },
      ]},
      { key: "home_cta", label: "Contact Section", icon: Phone, path: "/", fields: [
        { name: "headline", label: "Headline", type: "text" },
        { name: "subtext", label: "Subtext", type: "textarea" },
      ]},
    ],
  },
  {
    group: "About Page",
    icon: Info,
    path: "/about",
    items: [
      { key: "about_hero", label: "Hero", icon: Star, path: "/about", fields: [
        { name: "badge", label: "Badge Text", type: "text" },
        { name: "headline", label: "Headline", type: "text" },
        { name: "subtext", label: "Subtext", type: "textarea" },
        { name: "bg_image", label: "Background Image URL", type: "text" },
      ]},
      { key: "about_main", label: "Main Content", icon: FileText, path: "/about", fields: [
        { name: "badge", label: "Badge Label", type: "text" },
        { name: "headline", label: "Headline", type: "text" },
        { name: "paragraph1", label: "Paragraph 1", type: "textarea" },
        { name: "paragraph2", label: "Paragraph 2", type: "textarea" },
        { name: "paragraph3", label: "Paragraph 3", type: "textarea" },
        { name: "feature1", label: "Feature 1", type: "text" },
        { name: "feature2", label: "Feature 2", type: "text" },
        { name: "feature3", label: "Feature 3", type: "text" },
        { name: "feature4", label: "Feature 4", type: "text" },
        { name: "feature5", label: "Feature 5", type: "text" },
        { name: "image_url", label: "Side Image URL", type: "text" },
      ]},
      { key: "about_values", label: "Values Section", icon: Zap, path: "/about", fields: [
        { name: "headline", label: "Section Headline", type: "text" },
        { name: "value1_title", label: "Value 1 Title", type: "text" },
        { name: "value1_desc", label: "Value 1 Description", type: "textarea" },
        { name: "value2_title", label: "Value 2 Title", type: "text" },
        { name: "value2_desc", label: "Value 2 Description", type: "textarea" },
        { name: "value3_title", label: "Value 3 Title", type: "text" },
        { name: "value3_desc", label: "Value 3 Description", type: "textarea" },
      ]},
    ],
  },
  {
    group: "Contact Page",
    icon: Mail,
    path: "/contact",
    items: [
      { key: "contact_hero", label: "Hero", icon: Star, path: "/contact", fields: [
        { name: "badge", label: "Badge", type: "text" },
        { name: "headline", label: "Headline", type: "text" },
        { name: "subtext", label: "Subtext", type: "text" },
      ]},
      { key: "contact_info", label: "Info Section", icon: Phone, path: "/contact", fields: [
        { name: "headline", label: "Headline", type: "text" },
        { name: "intro_text", label: "Intro Paragraph", type: "textarea" },
        { name: "hours", label: "Business Hours", type: "text" },
        { name: "note", label: "Scheduling Note", type: "textarea" },
      ]},
    ],
  },
  {
    group: "Gallery",
    icon: Image,
    path: "/gallery",
    items: [
      { key: "gallery_page", label: "Gallery Page", icon: Image, path: "/gallery", fields: [
        { name: "badge", label: "Badge Text", type: "text" },
        { name: "headline", label: "Headline", type: "text" },
        { name: "subtext", label: "Subtext", type: "textarea" },
      ]},
    ],
  },
  {
    group: "Financing",
    icon: Star,
    path: "/financing",
    items: [
      { key: "financing_hero", label: "Hero Section", icon: Star, path: "/financing", fields: [
        { name: "badge", label: "Badge Text", type: "text" },
        { name: "headline", label: "Headline", type: "text" },
        { name: "subtext", label: "Subtext", type: "textarea" },
      ]},
      { key: "financing_options", label: "Financing Options", icon: FileText, path: "/financing", fields: [
        { name: "option1_title", label: "Option 1 Title", type: "text" },
        { name: "option1_desc", label: "Option 1 Description", type: "textarea" },
        { name: "option2_title", label: "Option 2 Title", type: "text" },
        { name: "option2_desc", label: "Option 2 Description", type: "textarea" },
        { name: "option3_title", label: "Option 3 Title", type: "text" },
        { name: "option3_desc", label: "Option 3 Description", type: "textarea" },
        { name: "cta_headline", label: "CTA Headline", type: "text" },
        { name: "cta_subtext", label: "CTA Subtext", type: "textarea" },
      ]},
    ],
  },
  {
    group: "Service Areas",
    icon: MapPin,
    path: "/service-areas",
    items: [
      { key: "service_areas_page", label: "Service Areas Page", icon: MapPin, path: "/service-areas", fields: [
        { name: "badge", label: "Badge Text", type: "text" },
        { name: "headline", label: "Headline", type: "text" },
        { name: "subtext", label: "Subtext", type: "textarea" },
        { name: "cta_headline", label: "CTA Headline", type: "text" },
        { name: "cta_subtext", label: "CTA Subtext", type: "textarea" },
      ]},
    ],
  },
  {
    group: "Blog",
    icon: FileText,
    path: "/blog",
    items: [
      { key: "blog_listing", label: "Blog Listing Page", icon: FileText, path: "/blog", fields: [
        { name: "badge", label: "Badge Text", type: "text" },
        { name: "headline", label: "Page Headline", type: "text" },
        { name: "subtext", label: "Page Subtext", type: "textarea" },
      ]},
    ],
  },
  {
    group: "Design Preview",
    icon: Sparkles,
    path: "/start",
    items: [
      { key: "start_page", label: "Design Preview Page", icon: Sparkles, path: "/start", fields: [
        { name: "badge", label: "Badge Text", type: "text" },
        { name: "headline", label: "Headline", type: "text" },
        { name: "subtext", label: "Subtext", type: "textarea" },
        { name: "step1_label", label: "Step 1 Label", type: "text" },
        { name: "step2_label", label: "Step 2 Label", type: "text" },
        { name: "step3_label", label: "Step 3 Label", type: "text" },
        { name: "cta_label", label: "CTA Button Label", type: "text" },
      ]},
    ],
  },
  {
    group: "Budget Estimator",
    icon: Columns,
    path: "/budget-estimator",
    items: [
      { key: "budget_estimator", label: "Budget Estimator Page", icon: Columns, path: "/budget-estimator", fields: [
        { name: "badge", label: "Badge Text", type: "text" },
        { name: "headline", label: "Headline", type: "text" },
        { name: "subtext", label: "Subtext", type: "textarea" },
      ]},
    ],
  },
  {
    group: "Services",
    icon: Wrench,
    items: [
      { key: "service_home_additions", label: "Home Additions", path: "/services/home-additions", fields: serviceFields() },
      { key: "service_decks", label: "Decks, Porches & Pergolas", path: "/services/decks-porches-pergolas", fields: serviceFields() },
      { key: "service_siding", label: "Siding", path: "/services/siding", fields: serviceFields() },
      { key: "service_kitchen", label: "Kitchen Remodeling", path: "/services/kitchen-remodeling", fields: serviceFields() },
      { key: "service_bathroom", label: "Bathroom Remodeling", path: "/services/bathroom-remodeling", fields: serviceFields() },
      { key: "service_carpentry", label: "Custom Carpentry", path: "/services/custom-carpentry", fields: serviceFields() },
    ],
  },
  {
    group: "Conversion",
    icon: Tag,
    items: [
      { key: "exit_intent", label: "Exit Intent Popup", icon: Tag, fields: [
         { name: "headline", label: "Popup Headline", type: "text" },
         { name: "subtext", label: "Popup Subtext", type: "textarea" },
         { name: "offer_badge", label: "Offer Badge Label", type: "text" },
         { name: "button_label", label: "Submit Button Label", type: "text" },
         { name: "campaign_name", label: "Campaign Name (tags the lead)", type: "text" },
         { name: "disclaimer_text", label: "Disclaimer Text (small print)", type: "textarea" },
         { name: "disclaimer_link_label", label: "Terms & Conditions Link Label", type: "text" },
         { name: "terms_and_conditions", label: "Terms & Conditions Content", type: "textarea" },
         { name: "image_url", label: "Popup Image URL", type: "text" },
       ]},
    ],
  },
  {
    group: "SEO & Meta",
    icon: Code,
    items: [
      { key: "meta_tags", label: "Meta Tags (All Pages)", icon: Code, isMetaTags: true },
    ],
  },
];

function serviceFields() {
  return [
    { name: "headline", label: "Hero Headline", type: "text" },
    { name: "intro", label: "Hero Intro Text", type: "textarea" },
    { name: "body1", label: "Body Paragraph 1", type: "textarea" },
    { name: "body2", label: "Body Paragraph 2", type: "textarea" },
    { name: "body3", label: "Body Paragraph 3", type: "textarea" },
    { name: "feature1", label: "Feature 1", type: "text" },
    { name: "feature2", label: "Feature 2", type: "text" },
    { name: "feature3", label: "Feature 3", type: "text" },
    { name: "feature4", label: "Feature 4", type: "text" },
    { name: "feature5", label: "Feature 5", type: "text" },
    { name: "feature6", label: "Feature 6", type: "text" },
    { name: "feature7", label: "Feature 7", type: "text" },
    { name: "feature8", label: "Feature 8", type: "text" },
    { name: "image_url", label: "Hero Image URL", type: "text" },
    { name: "meta_title", label: "Meta Title (SEO)", type: "text" },
    { name: "meta_description", label: "Meta Description (SEO)", type: "textarea" },
  ];
}

// Map page path → SEO audit page label
const PATH_TO_SEO_PAGE = {
  "/": "Home",
  "/about": "About",
  "/contact": "Contact",
  "/gallery": "Our Work",
  "/financing": "Financing",
  "/blog": "Blog",
  "/service-areas": "Service Areas",
  "/services/home-additions": "Services: Home Additions",
  "/services/decks-porches-pergolas": "Services: Decks, Porches & Pergolas",
  "/services/siding": "Services: Siding",
  "/services/kitchen-remodeling": "Services: Kitchen Remodel",
  "/services/bathroom-remodeling": "Services: Bathroom Remodel",
  "/services/custom-carpentry": "Services: Custom Cabinetry",
  "/start": "Design Preview",
  "/budget-estimator": "Estimator",
};

function SeoScorePill({ score }) {
  if (!score) return null;
  const color = score >= 80 ? "bg-green-100 text-green-700 border-green-200"
    : score >= 60 ? "bg-yellow-100 text-yellow-700 border-yellow-200"
    : "bg-red-100 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      <BarChart3 className="w-3 h-3" /> SEO {score}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminCMS() {
  const [activeSection, setActiveSection] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({ Global: true, "Home Page": true, Services: true });
  const [aiMode, setAiMode] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localData, setLocalData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePromptOverride, setImagePromptOverride] = useState("");
  const [popupPreviewOpen, setPopupPreviewOpen] = useState(false);

  const { data: allContent = {}, isLoading } = useAllSiteContent();
  const saveContent = useSaveContent();

  const { data: seoAudits = [] } = useQuery({
    queryKey: ["seo-audits-cms"],
    queryFn: () => base44.entities.SeoAudit.list("-created_date", 100),
  });

  // Build a map: page label → latest SEO score
  const seoScoreMap = seoAudits.reduce((acc, a) => {
    if (!acc[a.page] && a.score > 0) acc[a.page] = a.score;
    return acc;
  }, {});

  const getSeoScore = (path) => {
    if (!path) return null;
    const label = PATH_TO_SEO_PAGE[path];
    return label ? seoScoreMap[label] : null;
  };

  const handleSelectSection = (section) => {
    setActiveSection(section);
    setAiMode(false);
    setAiResult(null);
    const savedVal = allContent[section.key]?.value;
    const existing = (savedVal && typeof savedVal === "object") ? savedVal : {};
    const defaults = DEFAULT_CONTENT[section.key] || {};
    setLocalData({ ...defaults, ...existing });
    setSidebarOpen(false); // close on mobile after selection
  };

  const handleSave = async () => {
    setSaving(true);
    await saveContent.mutateAsync({ key: activeSection.key, value: localData });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAiGenerate = async () => {
    setAiGenerating(true);
    setAiResult(null);
    const context = activeSection
      ? `Section: ${activeSection.label}, Page: ${activeSection.path || "global"}`
      : `New page/section: ${aiTopic}`;
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert web content writer for Coen Construction, a Greater Boston MA general contractor (family-owned since 2010, specializes in home additions, decks, siding, kitchen remodeling, custom carpentry, snow removal). Generate compelling, SEO-optimized content for: ${context}. ${aiTopic ? `User instruction: ${aiTopic}` : ""} Return as JSON with these exact field names: ${activeSection?.fields?.map(f => f.name).join(", ")}`,
      response_json_schema: {
        type: "object",
        properties: Object.fromEntries((activeSection?.fields || []).map(f => [f.name, { type: "string" }])),
      },
    });
    setAiResult(res);
    setAiGenerating(false);
  };

  const applyAiResult = () => {
    if (aiResult) {
      setLocalData(prev => ({ ...prev, ...aiResult }));
      setAiResult(null);
      setAiMode(false);
    }
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    const prompt = imagePromptOverride || `${localData.headline || ""} ${localData.subtext || ""}`;
    const res = await base44.integrations.Core.GenerateImage({
      prompt: `Professional, high-quality image for a contractor marketing popup. Context: ${prompt}. Style: modern, clean, professional, inviting. Include construction/home improvement theme.`,
    });
    setLocalData(prev => ({ ...prev, image_url: res.url }));
    setImagePromptOverride("");
    setGeneratingImage(false);
  };

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const totalPages = SECTIONS.reduce((s, g) => s + g.items.length, 0);
  const savedPages = SECTIONS.reduce((s, g) => s + g.items.filter(i => !!allContent[i.key]).length, 0);

  const seoScore = activeSection?.path ? getSeoScore(activeSection.path) : null;

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="px-4 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-secondary">Site Content Editor</h2>
            <p className="text-xs text-gray-400 mt-0.5">{savedPages}/{totalPages} sections edited</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(savedPages / totalPages) * 100}%` }} />
        </div>
      </div>

      {/* Nav items */}
      <div className="py-2 overflow-y-auto flex-1">
        {SECTIONS.map(group => (
          <div key={group.group}>
            <button
              onClick={() => toggleGroup(group.group)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-muted transition-colors"
            >
              <group.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-left">{group.group}</span>
              {group.path && (
                <a href={group.path} target="_blank" onClick={e => e.stopPropagation()} className="text-gray-300 hover:text-primary transition-colors mr-1" title="Preview page">
                  <Globe className="w-3 h-3" />
                </a>
              )}
              {expandedGroups[group.group] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {expandedGroups[group.group] && (
              <div>
                {group.items.map(item => {
                  const hasContent = !!allContent[item.key];
                  const score = item.path ? getSeoScore(item.path) : null;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleSelectSection(item)}
                      className={`w-full flex items-center gap-2 px-5 py-2.5 text-sm text-left transition-colors ${
                        activeSection?.key === item.key
                          ? "bg-primary/10 text-primary border-r-2 border-primary font-semibold"
                          : "text-gray-600 hover:bg-muted"
                      }`}
                    >
                      <span className="flex-1 leading-tight">{item.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {score && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${score >= 80 ? "bg-green-100 text-green-600" : score >= 60 ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"}`}>
                            {score}
                          </span>
                        )}
                        {hasContent && <div className="w-1.5 h-1.5 rounded-full bg-green-400" title="Has saved content" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-[80vh] bg-gray-50 relative">

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
        w-72 lg:w-64 shrink-0
        bg-white border-r border-gray-100
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile header bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 text-sm font-semibold text-secondary bg-gray-100 px-3 py-1.5 rounded-lg"
          >
            <PanelLeft className="w-4 h-4" />
            {activeSection ? activeSection.label : "Select Section"}
          </button>
          {activeSection && (
            <span className="text-xs text-gray-400 truncate">{activeSection.path || "Global"}</span>
          )}
        </div>

        {!activeSection ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20 px-6">
            <Layout className="w-14 h-14 text-gray-200 mb-4" />
            <h3 className="text-xl font-bold text-secondary mb-2">Select a Section to Edit</h3>
            <p className="text-gray-500 text-sm max-w-sm mb-6">Choose any page section from the sidebar to view and edit its content. Changes are saved and reflected live on the website.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg">
              {SECTIONS.slice(0, 6).flatMap(g => g.items).slice(0, 6).map(item => (
                <button
                  key={item.key}
                  onClick={() => handleSelectSection(item)}
                  className="bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="text-xs font-semibold text-secondary">{item.label}</div>
                  {item.path && <div className="text-xs text-gray-400 mt-0.5">{item.path}</div>}
                </button>
              ))}
            </div>
            {/* Show "open sidebar" on mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="mt-6 lg:hidden flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              <Menu className="w-4 h-4" /> Browse All Sections
            </button>
          </div>
        ) : activeSection?.isMetaTags ? (
          <MetaTagsEditor />
        ) : (
          <div className="p-4 sm:p-6 max-w-3xl">

            {/* Section header */}
             <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
               <div className="min-w-0">
                 <div className="flex items-center gap-2 flex-wrap">
                   <h2 className="text-lg sm:text-xl font-bold text-secondary">{activeSection.label}</h2>
                   {activeSection.path && (
                     <a href={activeSection.path} target="_blank" className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0">
                       <Eye className="w-3 h-3" /> Preview
                     </a>
                   )}
                   {activeSection.key === "exit_intent" && (
                     <button
                       onClick={() => setPopupPreviewOpen(true)}
                       className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0 border border-primary px-2 py-1 rounded-lg"
                     >
                       <Monitor className="w-3 h-3" /> Preview Popup
                     </button>
                   )}
                 </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-gray-400">
                    {allContent[activeSection.key] ? "✓ Has saved content" : "No content saved — using defaults"}
                  </p>
                  {/* SEO Score Badge */}
                  {seoScore && (
                    <Link to="/admin/seo" className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors hover:shadow-sm group"
                      style={{ backgroundColor: seoScore >= 80 ? "#f0fdf4" : seoScore >= 60 ? "#fefce8" : "#fef2f2",
                               borderColor: seoScore >= 80 ? "#bbf7d0" : seoScore >= 60 ? "#fde68a" : "#fecaca",
                               color: seoScore >= 80 ? "#15803d" : seoScore >= 60 ? "#92400e" : "#b91c1c" }}>
                      <BarChart3 className="w-3 h-3" />
                      SEO Score: {seoScore}
                      <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                    </Link>
                  )}
                  {!seoScore && activeSection.path && PATH_TO_SEO_PAGE[activeSection.path] && (
                    <Link to="/admin/seo" className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
                      <TrendingUp className="w-3 h-3" /> Run SEO Audit
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setAiMode(!aiMode); setAiResult(null); }}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary px-3 py-2 rounded-lg hover:bg-primary/5 transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" /> AI Fill
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-sm font-bold bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
                </button>
              </div>
            </div>

            {/* AI Panel */}
            {aiMode && (
              <div className="bg-white border border-primary/20 rounded-xl p-4 mb-5 space-y-3">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <Sparkles className="w-4 h-4" /> AI Content Generator
                </div>
                <textarea
                  rows={2}
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder="Optional: specific instructions (e.g. 'focus on winter storm readiness')"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button onClick={handleAiGenerate} disabled={aiGenerating}
                    className="flex items-center gap-2 bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
                    {aiGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
                  </button>
                  <button onClick={() => setAiMode(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
                </div>
                {aiResult && (
                  <div className="border border-green-200 bg-green-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-green-700 font-semibold text-sm"><Check className="w-4 h-4" /> AI Generated</div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {Object.entries(aiResult).map(([k, v]) => (
                        <div key={k} className="text-xs"><span className="font-semibold text-gray-500 uppercase">{k}:</span> <span className="text-gray-700">{v}</span></div>
                      ))}
                    </div>
                    <button onClick={applyAiResult} className="w-full bg-green-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-green-700 transition-colors">Apply to Fields</button>
                  </div>
                )}
              </div>
            )}

            {/* Fields */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
              {activeSection.fields.map(field => (
                <div key={field.name}>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea
                      rows={field.name.includes("meta_description") || field.name.includes("paragraph") ? 4 : 3}
                      value={localData[field.name] || ""}
                      onChange={e => setLocalData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 resize-y focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  ) : (
                    <input
                      type="text"
                      value={localData[field.name] || ""}
                      onChange={e => setLocalData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  )}
                  {field.name === "image_url" && (
                    <div className="mt-3 space-y-2">
                      {localData[field.name] && (
                        <div className="relative">
                          <img src={localData[field.name]} alt="popup preview" className="w-full h-40 rounded-lg border border-gray-200 object-cover" />
                          <button
                            type="button"
                            onClick={() => setLocalData(prev => ({ ...prev, image_url: "" }))}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Generate Image (optional custom prompt)</label>
                          <input
                            type="text"
                            value={imagePromptOverride}
                            onChange={e => setImagePromptOverride(e.target.value)}
                            placeholder="Leave empty to auto-generate from headline/subtext"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateImage}
                          disabled={generatingImage}
                          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 text-xs"
                        >
                          {generatingImage ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating...</> : <><Sparkles className="w-3 h-3" /> Generate/Regenerate Image</>}
                        </button>
                      </div>
                    </div>
                  )}
                  {(field.name.includes("image") || field.name.includes("bg_image")) && field.name !== "image_url" && localData[field.name] && (
                    <img src={localData[field.name]} alt="preview" className="mt-2 h-20 w-auto rounded-lg border border-gray-200 object-cover" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-400">{activeSection.fields.length} fields</p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-primary text-white font-bold px-6 py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Exit Intent Popup Preview Modal */}
      {popupPreviewOpen && activeSection?.key === "exit_intent" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`relative bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl w-full overflow-hidden ${localData.image_url ? "max-w-3xl" : "max-w-lg"}`}>
            <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Left side - Image/Visual */}
              {localData.image_url && (
                <div className="hidden md:block relative h-full min-h-64 overflow-hidden bg-gradient-to-br from-secondary/10 to-primary/10">
                  <img src={localData.image_url} alt="offer" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-secondary/20 to-transparent" />
                </div>
              )}

              {/* Right side - Form */}
              <div className="p-6 sm:p-8 flex flex-col justify-center relative">
                <button
                  onClick={() => setPopupPreviewOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1.5 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                <div>
                  <div className="mb-5">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-xs mb-3">
                      <Zap className="w-3.5 h-3.5" />
                      {localData.offer_badge || "Free Consultation"}
                    </div>
                    <h2 className="text-2xl font-bold text-secondary mb-2 leading-tight">
                      {localData.headline || "One Last Step Before You Go"}
                    </h2>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {localData.subtext || "Get your free estimate and see how Coen Construction can transform your space."}
                    </p>
                  </div>

                  <form className="space-y-3">
                    <input
                      disabled
                      placeholder="Full Name"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 bg-white opacity-50"
                    />
                    <input
                      disabled
                      type="email"
                      placeholder="Email Address"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 bg-white opacity-50"
                    />
                    <input
                      disabled
                      type="tel"
                      placeholder="Phone Number"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 bg-white opacity-50"
                    />
                    <input
                      disabled
                      placeholder="Address"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 bg-white opacity-50"
                    />

                    <button
                      disabled
                      className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center gap-2 mt-5 opacity-80"
                    >
                      {localData.button_label || "Get My Free Estimate"}
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPopupPreviewOpen(false)}
                      className="w-full text-gray-500 hover:text-gray-700 font-medium py-1.5 text-sm transition-colors"
                    >
                      Maybe later
                    </button>

                    {localData.disclaimer_text && (
                      <p className="text-xs text-gray-400 text-center leading-relaxed pt-1">
                        {localData.disclaimer_text}{" "}
                        {localData.terms_and_conditions && (
                          <span className="text-primary font-semibold cursor-pointer hover:underline">
                            {localData.disclaimer_link_label || "Terms & Conditions"}
                          </span>
                        )}
                      </p>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}