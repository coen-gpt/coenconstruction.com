import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import SEOHead from '@/components/SEOHead';
import { LOCAL_BUSINESS, breadcrumbSchema } from '@/lib/schema';
import { DesignPreviewEvents } from '@/lib/analytics';
import BookWalkthroughCTA from "@/components/website/BookWalkthroughCTA";

import StepIndicator from '../components/start/StepIndicator';
import LeadForm from '../components/start/LeadForm';
import PhotoUpload from '../components/start/PhotoUpload';
import DesignGenerator from '../components/start/DesignGenerator';
import RetrieveProjectsModal from '../components/projects/RetrieveProjectsModal';
import { SMS_CONSENT_TEXT_VERSION } from '@/components/sms/SmsOptInCheckbox';
import { Button } from '@/components/ui/button';
import { FolderOpen } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

export default function StartProject() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedType = urlParams.get('type') || '';
  const preAddress = urlParams.get('address') || '';
  const preName = urlParams.get('name') || '';
  const preEmail = urlParams.get('email') || '';
  const prePhone = urlParams.get('phone') || '';
  const preDesc = urlParams.get('description') || '';

  const [step, setStep] = useState(1);
  const [project, setProject] = useState(null);
  const [createdLeadRecord, setCreatedLeadRecord] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showRetrieveModal, setShowRetrieveModal] = useState(false);

  useEffect(() => {
    DesignPreviewEvents.toolOpened(preselectedType);
  }, [preselectedType]);

  const [formData, setFormData] = useState({
    full_name: preName,
    email: preEmail,
    phone: prePhone,
    address: preAddress,
    project_description: preDesc,
    project_type: preselectedType,
    budget_range: '',
    style_preferences: [],
    sms_opt_in_status: false
  });

  const handleFormSubmit = async ({ clientIp } = {}) => {
    setIsSubmitting(true);
    setSubmitError("");
    try {
    const normalizedPhone = formData.phone.replace(/[\s().-]/g, '').trim();
    // A2P 10DLC: record IP + timestamp alongside the consent decision (true or false)
    const smsFields = {
      sms_opt_in_status: !!formData.sms_opt_in_status,
      sms_opt_in_timestamp: new Date().toISOString(),
      sms_opt_in_ip: clientIp || undefined,
      ...(formData.sms_opt_in_status ? {
        phone_number: normalizedPhone,
        sms_opt_in_method: 'WEB_FORM',
        sms_consent_text_version: SMS_CONSENT_TEXT_VERSION,
      } : {}),
    };

    const { sms_opt_in_status, phone_number, sms_opt_in_timestamp, sms_opt_in_method, sms_consent_text_version, ...projectFormData } = formData;
    const projectData = {
      ...projectFormData,
      status: 'new_lead',
      before_photos: [],
      inspiration_photos: [],
      documents: [],
      ai_designs: []
    };

    const createdProject = await base44.entities.Project.create(projectData);

    const createdLead = await base44.entities.Lead.create({
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      message: formData.project_description,
      project_type: formData.project_type === 'home_addition' ? 'Home Addition'
        : formData.project_type === 'deck_remodel' ? 'Deck / Porch / Pergola'
        : formData.project_type === 'kitchen_remodel' ? 'Kitchen Remodel'
        : formData.project_type === 'bathroom_remodel' ? 'Bathroom Remodel'
        : 'General Inquiry',
      source: 'Design Preview',
      status: 'New',
      project_id: createdProject.id,
      ...smsFields
    });

    if (formData.sms_opt_in_status) {
      // SmsConsent is RLS-locked — dedupe + create happen server-side
      await base44.functions.invoke("recordSmsConsent", {
        phone_number: normalizedPhone,
        client_name: formData.full_name,
        client_email: formData.email,
        sms_consent_text_version: SMS_CONSENT_TEXT_VERSION,
        sms_opt_in_ip: clientIp || undefined,
        source_lead_id: createdLead.id,
      }).catch((err) => console.error("SMS consent record failed", err));
    }

    const created = createdProject;
    setCreatedLeadRecord(createdLead);
    setProject(created);
    setStep(2);
    } catch (err) {
      console.error("Design Preview lead creation failed", err);
      setSubmitError("We couldn't save your request. Please try again or call (617) 857-COEN.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProjectUpdate = async (updates) => {
    await base44.entities.Project.update(project.id, updates);
    setProject(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free AI Design Preview — See Your Renovation Before You Build"
        description="Upload a photo of your home and get a free AI-generated design preview of your kitchen, bathroom, deck, or addition project from Coen Construction in Greater Boston."
        keywords={["AI home design preview", "visualize renovation Boston", "free design tool remodeling", "see my remodel before building"]}
        canonicalUrl="https://coenconstruction.com/start"
        structuredData={[LOCAL_BUSINESS, breadcrumbSchema([
          { name: "Free Design Preview", url: "/start" }
        ])]}
      />
      <div className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <img
                src="https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/08e968b7c_COENLogo-white.png"
                alt="Coen Construction"
                className="h-16 w-16 object-contain"
              />
              <h1 className="text-3xl font-bold text-secondary">Free Design Preview</h1>
            </div>
            <Button
              onClick={() => setShowRetrieveModal(true)}
              className="gap-2 w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <FolderOpen className="w-4 h-4" />
              Retrieve My Projects
            </Button>
          </div>
          
          <StepIndicator currentStep={step} />

          {step >= 2 && createdLeadRecord && (
            <div className="mb-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <BookWalkthroughCTA
                lead={createdLeadRecord}
                title={step === 2 ? "Request received!" : "Love your design?"}
                subtitle={step === 2
                  ? "Build your free AI design preview below — or lock in your walkthrough time first."
                  : "Book your free in-home walkthrough and we'll turn it into a real quote."}
              />
            </div>
          )}

          {submitError && step === 1 && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{submitError}</p>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <LeadForm
                key="form"
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                isSubmitting={isSubmitting}
              />
            )}

            {step === 2 && project && (
              <PhotoUpload
                key="photos"
                project={project}
                onUpdate={handleProjectUpdate}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && project && (
              <DesignGenerator
                key="design"
                project={project}
                onUpdate={handleProjectUpdate}
                onBack={() => setStep(2)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <RetrieveProjectsModal open={showRetrieveModal} onOpenChange={setShowRetrieveModal} />
    </div>
  );
}