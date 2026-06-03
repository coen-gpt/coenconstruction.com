import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

import StepIndicator from '../components/start/StepIndicator';
import LeadForm from '../components/start/LeadForm';
import PhotoUpload from '../components/start/PhotoUpload';
import DesignGenerator from '../components/start/DesignGenerator';
import RetrieveProjectsModal from '../components/projects/RetrieveProjectsModal';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRetrieveModal, setShowRetrieveModal] = useState(false);

  const [formData, setFormData] = useState({
    full_name: preName,
    email: preEmail,
    phone: prePhone,
    address: preAddress,
    project_description: preDesc,
    project_type: preselectedType,
    budget_range: '',
    style_preferences: []
  });

  const handleFormSubmit = async () => {
    setIsSubmitting(true);
    const projectData = {
      ...formData,
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
      project_id: createdProject.id
    });

    const created = createdProject;
    setProject(created);
    setStep(2);
    setIsSubmitting(false);
  };

  const handleProjectUpdate = async (updates) => {
    await base44.entities.Project.update(project.id, updates);
    setProject(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="min-h-screen bg-background">
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