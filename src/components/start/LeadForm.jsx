import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { ArrowRight, User, Mail, Phone, MapPin, FileText } from 'lucide-react';
import AddressInput from '@/components/AddressInput';
import SmsOptInCheckbox from '@/components/sms/SmsOptInCheckbox';
import TurnstileWidget from '@/components/security/TurnstileWidget';
import { base44 } from '@/api/base44Client';
import { fetchClientIp } from '@/lib/clientIp';

const projectTypeLabels = {
  home_addition: 'Home Addition',
  deck_remodel: 'Deck Remodel',
  kitchen_remodel: 'Kitchen Remodel',
  bathroom_remodel: 'Bathroom Remodel',
  other: 'Other'
};

const budgetLabels = {
  under_25k: 'Under $25,000',
  '25k_50k': '$25,000 – $50,000',
  '50k_100k': '$50,000 – $100,000',
  '100k_200k': '$100,000 – $200,000',
  over_200k: 'Over $200,000'
};

export default function LeadForm({ formData, setFormData, onSubmit, isSubmitting }) {
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const [securityError, setSecurityError] = React.useState("");

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // A2P 10DLC: SMS consent is intentionally NOT part of validity — it must be optional
  // Lower step-1 friction: only name/email/phone/project type + Turnstile are required.
  // Address and description are optional here (collected later / refined on the project).
  const isValid = formData.full_name && formData.email && formData.phone && formData.project_type && !!turnstileToken;

  // Verify the Turnstile token server-side before handing off to the parent submit
  const handleContinue = async () => {
    setSecurityError("");
    const verify = await base44.functions.invoke("verifyTurnstile", { token: turnstileToken }).catch(() => null);
    if (verify?.data && verify.data.success === false) {
      setSecurityError("Security check failed. Please complete the verification and try again.");
      return;
    }
    const clientIp = verify?.data?.ip || await fetchClientIp();
    onSubmit({ clientIp });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="mb-8">
        <h2 className="font-heading text-2xl md:text-3xl mb-2">Let's Get to Know Your Project</h2>
        <p className="text-muted-foreground">Tell us about yourself and your vision. All fields marked with * are required.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="full_name" className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Full Name *
          </Label>
          <Input
            id="full_name"
            placeholder="John Smith"
            value={formData.full_name}
            onChange={(e) => handleChange('full_name', e.target.value)}
            className="rounded-xl h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Email *
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="rounded-xl h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" /> Phone *
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="rounded-xl h-12"
          />
        </div>

        {/* A2P 10DLC: OPTIONAL SMS consent — full-width row directly below the
            phone field so the 2-column grid stays aligned. Carriers reject
            campaigns that make consent a condition of submission. */}
        <div className="md:col-span-2">
          <SmsOptInCheckbox
            id="sms-opt-in-lead"
            checked={!!formData.sms_opt_in_status}
            onCheckedChange={(checked) => handleChange('sms_opt_in_status', checked)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Property Address <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <AddressInput
            value={formData.address}
            onChange={(val) => handleChange('address', val)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">Project Type *</Label>
          <Select value={formData.project_type} onValueChange={(v) => handleChange('project_type', v)}>
            <SelectTrigger className="rounded-xl h-12">
              <SelectValue placeholder="Select project type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(projectTypeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Budget Range (optional)</Label>
          <Select value={formData.budget_range || ''} onValueChange={(v) => handleChange('budget_range', v)}>
            <SelectTrigger className="rounded-xl h-12">
              <SelectValue placeholder="Select budget range" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(budgetLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Project Description <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Describe your dream project... What do you envision? Any specific features, materials, or styles you love?"
          value={formData.project_description}
          onChange={(e) => handleChange('project_description', e.target.value)}
          className="rounded-xl min-h-[120px] resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label>Design Style Preferences (optional)</Label>
        <div className="flex flex-wrap gap-2">
          {['Modern', 'Traditional', 'Farmhouse', 'Minimalist', 'Industrial', 'Coastal', 'Rustic', 'Contemporary'].map(style => {
            const selected = (formData.style_preferences || []).includes(style);
            return (
              <button
                key={style}
                type="button"
                onClick={() => {
                  const current = formData.style_preferences || [];
                  handleChange('style_preferences', selected ? current.filter(s => s !== style) : [...current, style]);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selected
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {style}
              </button>
            );
          })}
        </div>
      </div>


      <TurnstileWidget
        onVerify={setTurnstileToken}
        onExpire={() => setTurnstileToken("")}
      />
      {securityError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3" role="alert">{securityError}</p>
      )}

      <Button
        onClick={handleContinue}
        disabled={!isValid || isSubmitting}
        size="lg"
        className="w-full md:w-auto rounded-xl px-10 py-6 text-lg gap-2 shadow-lg shadow-primary/20"
      >
        {isSubmitting ? 'Saving...' : 'Continue to Upload Photos'}
        <ArrowRight className="w-5 h-5" />
      </Button>
    </motion.div>
  );
}