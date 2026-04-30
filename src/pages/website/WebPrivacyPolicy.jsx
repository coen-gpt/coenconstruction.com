import { Helmet } from "react-helmet";

export default function WebPrivacyPolicy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | Coen Construction</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <section className="bg-secondary text-white py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="text-white/70 mt-2">Last updated: April 2026</p>
        </div>
      </section>
      <section className="py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto prose text-gray-600 space-y-5">
          <p>Coen Construction ("we," "our," or "us") is committed to protecting your privacy. This policy explains how we collect, use, and protect information submitted through our website at coenconstruction.com.</p>
          <h2 className="text-xl font-bold text-secondary">Information We Collect</h2>
          <p>We collect information you voluntarily provide through our contact forms, including your name, email address, phone number, and project details. We may also collect standard web traffic data through analytics tools.</p>
          <h2 className="text-xl font-bold text-secondary">How We Use Your Information</h2>
          <p>We use your information solely to respond to your inquiry, provide estimates, and communicate about your project. We do not sell or share your personal information with third parties for marketing purposes.</p>
          <h2 className="text-xl font-bold text-secondary">Contact Us</h2>
          <p>If you have questions about this privacy policy, contact us at info@coenconstruction.com or call (617) 857-COEN.</p>
        </div>
      </section>
    </>
  );
}