import React from 'react';
import { Check } from 'lucide-react';

const steps = [
  { label: 'Your Info', number: 1 },
  { label: 'Photos', number: 2 },
  { label: 'AI Design', number: 3 }
];

export default function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((step, i) => (
        <React.Fragment key={step.number}>
          <div className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                currentStep > step.number
                  ? 'bg-accent text-accent-foreground'
                  : currentStep === step.number
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
            </div>
            <span
              className={`text-sm font-medium hidden sm:block ${
                currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-12 md:w-20 h-0.5 mx-2 transition-all ${
                currentStep > step.number ? 'bg-accent' : 'bg-muted'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}