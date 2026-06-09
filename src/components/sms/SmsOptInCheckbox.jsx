import React from 'react';

export const SMS_CONSENT_TEXT_VERSION = 'coen-sms-consent-v1-2026-06-09';
export const SMS_CONSENT_TEXT = 'By providing your phone number, you agree to receive text messages from Coen Construction for project updates and scheduling. Message and data rates may apply. Message frequency varies. Reply STOP to opt out. View our Privacy Policy and Terms of Service.';

export default function SmsOptInCheckbox({ checked, onCheckedChange, id = 'sms-opt-in' }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded border border-gray-200 bg-gray-50">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="mt-1 w-5 h-5 accent-orange-500 cursor-pointer shrink-0"
      />
      <label htmlFor={id} className="text-xs leading-5 text-gray-700 cursor-pointer select-none">
        By providing your phone number, you agree to receive text messages from Coen Construction for project updates and scheduling. Message and data rates may apply. Message frequency varies. Reply STOP to opt out. View our{' '}
        <a href="/privacy-policy" className="font-semibold text-primary underline" target="_blank" rel="noreferrer">Privacy Policy</a>{' '}
        and{' '}
        <a href="/privacy-policy#terms-of-service" className="font-semibold text-primary underline" target="_blank" rel="noreferrer">Terms of Service</a>.
      </label>
    </div>
  );
}