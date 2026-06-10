import React from 'react';

// A2P 10DLC (Twilio) compliance: the consent language below is the exact
// registered opt-in copy. If it changes, bump the version string so stored
// SmsConsent records always reference the wording the user actually agreed to.
export const SMS_CONSENT_TEXT_VERSION = 'coen-sms-consent-v2-2026-06-10';
export const SMS_CONSENT_TEXT =
  'By checking this box, you agree to receive automated project updates and scheduling text messages from Coen Construction. Message and data rates may apply. Reply STOP to opt-out. Privacy Policy and Terms can be found at https://coenconstruction.com/privacy.';

export default function SmsOptInCheckbox({ checked, onCheckedChange, id = 'sms-opt-in', required = true, error = false }) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded border transition-colors ${
        error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        aria-required={required}
        aria-invalid={error || undefined}
        aria-describedby={`${id}-label`}
        className="mt-1 w-5 h-5 accent-orange-500 cursor-pointer shrink-0"
      />
      <label id={`${id}-label`} htmlFor={id} className="text-xs leading-5 text-gray-700 cursor-pointer select-none">
        By checking this box, you agree to receive automated project updates and scheduling text
        messages from Coen Construction. Message and data rates may apply. Reply STOP to opt-out.
        Privacy Policy and Terms can be found at{' '}
        <a
          href="https://coenconstruction.com/privacy"
          className="font-semibold text-primary underline"
          target="_blank"
          rel="noreferrer"
        >
          https://coenconstruction.com/privacy
        </a>
        .{required ? <span className="text-red-500 font-semibold"> *</span> : null}
      </label>
    </div>
  );
}
