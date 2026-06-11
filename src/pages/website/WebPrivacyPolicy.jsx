import SEOHead from "@/components/SEOHead";

export default function WebPrivacyPolicy() {
  return (
    <>
      <SEOHead
        title="Privacy Policy"
        description="How Coen Construction collects, uses, and protects information submitted through coenconstruction.com."
        canonicalUrl="https://coenconstruction.com/privacy-policy"
      />
      <section className="bg-secondary text-white py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="text-white/70 mt-2">Last updated: June 2026</p>
        </div>
      </section>
      <section className="py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto prose text-gray-600 space-y-5">
          <p>Coen Construction ("we," "our," or "us") is committed to protecting your privacy. This policy explains how we collect, use, and protect information submitted through our website at coenconstruction.com.</p>
          <h2 className="text-xl font-bold text-secondary">Information We Collect</h2>
          <p>We collect information you voluntarily provide through our contact forms, including your name, email address, phone number, and project details. We may also collect standard web traffic data through analytics tools.</p>
          <h2 className="text-xl font-bold text-secondary">How We Use Your Information</h2>
          <p>We use your information solely to respond to your inquiry, provide estimates, and communicate about your project. We do not sell or share your personal information with third parties for marketing purposes.</p>
          <h2 className="text-xl font-bold text-secondary">SMS / Mobile Messaging</h2>
          <p>If you provide your mobile phone number and opt in, Coen Construction may send text messages related to project scheduling, estimates, appointments, reminders, and project updates. Message frequency varies. Message and data rates may apply.</p>
          {/* A2P 10DLC carrier-required disclosure — exact wording, do not edit */}
          <p className="font-semibold text-secondary">Mobile information will not be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>
          <p>Mobile phone numbers and SMS consent information will not be shared, sold, rented, or disclosed to third parties or affiliates for marketing or promotional purposes. Mobile information is used solely for the messaging program described in this section — to send the project, scheduling, and service communications you requested or agreed to receive from Coen Construction.</p>
          <p>You may opt out of text messages at any time by replying STOP. For help, reply HELP or contact us at info@coenconstruction.com or (617) 857-COEN. Carriers are not liable for delayed or undelivered messages.</p>
          <p>Our full messaging terms are available in our <a href="/terms" className="text-primary font-semibold underline">Terms and Conditions</a>.</p>
          <h2 id="terms-of-service" className="text-xl font-bold text-secondary">Terms and Conditions</h2>
          <p>By submitting a form on this website, requesting an estimate, or opting in to SMS communications, you agree that Coen Construction may contact you using the information you provide for project-related communication, including estimates, scheduling, reminders, and service updates.</p>
          <p>SMS Terms: By providing your phone number, you agree to receive text messages from Coen Construction. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. Consent to receive text messages is not a condition of purchase.</p>
          <p>Coen Construction does not share mobile numbers or SMS opt-in data with third parties for marketing or promotional purposes.</p>
          <h2 className="text-xl font-bold text-secondary">Contact Us</h2>
          <p>If you have questions about this privacy policy, contact us at info@coenconstruction.com or call (617) 857-COEN.</p>
        </div>
      </section>
    </>
  );
}