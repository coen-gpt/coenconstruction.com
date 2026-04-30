import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { DollarSign, Calendar, Save } from 'lucide-react';

const budgetRanges = {
  under_25k: 'Under $25,000',
  '25k_50k': '$25,000 - $50,000',
  '50k_100k': '$50,000 - $100,000',
  '100k_200k': '$100,000 - $200,000',
  over_200k: 'Over $200,000'
};

export default function BudgetTimeline({ project, onUpdate }) {
  const [budget, setBudget] = useState(project.budget_range || '');
  const [timeline, setTimeline] = useState(project.timeline_months || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({
      budget_range: budget,
      timeline_months: timeline ? parseInt(timeline) : null
    });
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-card border border-border space-y-6"
    >
      <h3 className="font-semibold text-lg">Project Details</h3>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Budget */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="w-4 h-4 text-primary" />
            Budget Range
          </label>
          <select
            value={budget}
            onChange={e => setBudget(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          >
            <option value="">Select budget range</option>
            {Object.entries(budgetRanges).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="w-4 h-4 text-primary" />
            Project Timeline (months)
          </label>
          <input
            type="number"
            min="1"
            max="60"
            value={timeline}
            onChange={e => setTimeline(e.target.value)}
            placeholder="e.g., 3 months"
            className="w-full px-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          />
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        size="lg"
        className="w-full rounded-xl gap-2"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save Budget & Timeline'}
      </Button>
    </motion.div>
  );
}