import SEOHead from "@/components/SEOHead";

export default function WebTerms() {
  return (
    <>
      <SEOHead
        title="Terms and Conditions"
        description="Terms and conditions for using the Coen Construction website and services, including estimates, project communications, and SMS messaging policies."
        canonicalUrl="https://coenconstruction.com/terms"
      />
      <section className="bg-secondary text-white py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold">Terms and Conditions</h1>
          <p className="text-white/70 mt-2">Last updated: June 2026</p>
        </div>
      </section>

      <section className="py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto prose text-gray-600 space-y-5">
          <p>By using this website, submitting a project inquiry, requesting an estimate, or opting in to communications from Coen Construction, you agree to the terms below.</p>

          <h2 className="text-xl font-bold text-secondary">Project Communications</h2>
          <p>Coen Construction may contact you using the information you provide to respond to your inquiry, discuss your project, schedule appointments, send estimates, provide reminders, and share project-related updates.</p>

          <h2 className="text-xl font-bold text-secondary">SMS / Text Message Terms</h2>
          <p>By providing your mobile phone number and opting in, you agree to receive text messages from Coen Construction related to project scheduling, estimates, appointments, reminders, and project updates.</p>
          <p>Message frequency varies. Message and data rates may apply. You can opt out at any time by replying STOP to any message, after which you will receive a one-time confirmation that you have been unsubscribed and will receive no further messages. For assistance, reply HELP or contact us at info@coenconstruction.com or (617) 857-COEN.</p>
          <p>Consent to receive text messages is not a condition of purchase. Mobile phone numbers and SMS consent information are not shared, sold, rented, or disclosed to third parties or affiliates for marketing or promotional purposes.</p>
          {/* A2P 10DLC carrier-required disclosure — exact wording, do not edit */}
          <p className="font-semibold text-secondary">Mobile information will not be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>
          <p>Carriers are not liable for delayed or undelivered messages.</p>

          <h2 className="text-xl font-bold text-secondary">Privacy</h2>
          <p>Our collection and use of personal information is described in our <a href="/privacy" className="text-primary font-semibold underline">Privacy Policy</a>.</p>

          <h2 className="text-xl font-bold text-secondary">Contact Us</h2>
          <p>If you have questions about these terms, contact Coen Construction at info@coenconstruction.com or call (617) 857-COEN.</p>
        </div>
      </section>
    </>
  );
}