import React from 'react';

// A2P 10DLC (Twilio) compliance: the consent language below is the exact
// registered opt-in copy. If it changes, bump the version string so stored
// SmsConsent records always reference the wording the user actually agreed to.
// Carriers require SMS consent to be OPTIONAL — never gate form submission on it.
export const SMS_CONSENT_TEXT_VERSION = 'coen-sms-consent-v3-2026-06-10';
export const SMS_CONSENT_TEXT =
  'By checking this box, you agree to receive automated project updates and scheduling text messages from Coen Construction. Message and data rates may apply. Reply STOP to opt-out. Privacy Policy and Terms can be found at coenconstruction.com/privacy-policy and coenconstruction.com/terms.';

export default function SmsOptInCheckbox({ checked, onCheckedChange, id = 'sms-opt-in' }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded border border-gray-200 bg-gray-50">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        aria-describedby={`${id}-label`}
        className="mt-1 w-5 h-5 accent-orange-500 cursor-pointer shrink-0"
      />
      <label id={`${id}-label`} htmlFor={id} className="text-xs leading-5 text-gray-700 cursor-pointer select-none">
        By checking this box, you agree to receive automated project updates and scheduling text
        messages from Coen Construction. Message and data rates may apply. Reply STOP to opt-out.{' '}
        <a
          href="/privacy-policy"
          className="font-semibold text-primary underline"
          target="_blank"
          rel="noreferrer"
        >
          Privacy Policy
        </a>{' '}
        and{' '}
        <a
          href="/terms"
          className="font-semibold text-primary underline"
          target="_blank"
          rel="noreferrer"
        >
          Terms
        </a>{' '}
        can be found at coenconstruction.com/privacy-policy and coenconstruction.com/terms.
      </label>
    </div>
  );
}
