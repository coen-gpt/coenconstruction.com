import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Settings, Plus, X } from 'lucide-react';

const customizationOptions = {
  kitchen_remodel: {
    wall_color: ['White', 'Cream', 'Gray', 'Soft Blue', 'Sage Green', 'Pale Yellow'],
    cabinet_style: ['Shaker', 'Flat Panel', 'Raised Panel', 'Glass Front', 'Open Shelving'],
    cabinet_color: ['White', 'Cream', 'Gray', 'Navy', 'Wood Tone', 'Black'],
    countertop_type: ['Granite', 'Quartz', 'Marble', 'Laminate', 'Wood Block', 'Stainless Steel'],
    flooring_type: ['Hardwood', 'Tile', 'Vinyl Plank', 'Concrete', 'Marble', 'Cork'],
    furniture: ['Island with Seating', 'Breakfast Nook', 'Bar Stools', 'Dining Table', 'Open Shelving', 'Walk-in Pantry']
  },
  bathroom_remodel: {
    wall_color: ['White', 'Soft Gray', 'Pale Blue', 'Warm Beige', 'Sage Green', 'Blush Pink'],
    flooring_type: ['Marble', 'Porcelain Tile', 'Vinyl Plank', 'Travertine', 'Slate', 'Granite'],
    countertop_type: ['Marble', 'Quartz', 'Granite', 'Solid Surface', 'Wood', 'Concrete'],
    cabinet_style: ['Shaker', 'Flat Panel', 'Transitional', 'Modern', 'Traditional'],
    cabinet_color: ['White', 'Gray', 'Dark Gray', 'Wood Tone', 'Navy'],
    furniture: ['Vanity with Storage', 'Double Sink', 'Floating Shelves', 'Towel Racks', 'Medicine Cabinet']
  },
  deck_remodel: {
    deck_color: ['Pressure Treated (Gray)', 'Dark Brown', 'Redwood', 'Tropical Brown', 'Charcoal'],
    furniture: ['Lounge Chairs', 'Dining Set', 'Built-in Benches', 'Fire Pit', 'Hot Tub Area', 'Pergola Shade'],
    wall_color: ['Natural Wood', 'Dark Stain', 'Translucent Gray', 'Warm Brown']
  },
  home_addition: {
    wall_color: ['White', 'Cream', 'Gray', 'Soft Blue', 'Warm Beige'],
    flooring_type: ['Hardwood', 'Tile', 'Vinyl Plank', 'Concrete', 'Polished Concrete'],
    furniture: ['Living Room Set', 'Bedroom Furniture', 'Workspace Desk', 'Built-in Shelving', 'Window Seating'],
    countertop_type: ['Granite', 'Quartz', 'Laminate', 'Butcher Block']
  },
  siding: {
    siding_style: ['Vinyl', 'Fiber Cement', 'Wood', 'Metal', 'Composite'],
    siding_color: ['White', 'Cream', 'Gray', 'Charcoal', 'Warm Brown', 'Navy', 'Black'],
    trim_color: ['White', 'Gray', 'Dark Gray', 'Cream', 'Black']
  }
};

export default function ProjectCustomizer({ project, onUpdate }) {
  const [customizations, setCustomizations] = useState(project.customizations || {});
  const [saving, setSaving] = useState(false);

  const projectType = project.project_type;
  const availableOptions = customizationOptions[projectType] || {};

  const handleOptionChange = (key, value) => {
    setCustomizations(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleArrayOptionToggle = (key, value) => {
    setCustomizations(prev => {
      const current = prev[key] || [];
      if (current.includes(value)) {
        return { ...prev, [key]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [key]: [...current, value] };
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({ customizations });
    setSaving(false);
  };

  if (Object.keys(availableOptions).length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-card border border-border space-y-6"
    >
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">Customize Your Design</h3>
      </div>

      <div className="space-y-4">
        {Object.entries(availableOptions).map(([key, options]) => {
          const isArray = Array.isArray(options) && key === 'furniture';
          const currentValue = customizations[key];

          return (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium capitalize">
                {key.replace(/_/g, ' ')}
              </label>

              {isArray ? (
                <div className="flex flex-wrap gap-2">
                  {options.map(option => (
                    <button
                      key={option}
                      onClick={() => handleArrayOptionToggle(key, option)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        currentValue?.includes(option)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {currentValue?.includes(option) && <span className="mr-1">✓</span>}
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  value={currentValue || ''}
                  onChange={e => handleOptionChange(key, e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                >
                  <option value="">Select {key.replace(/_/g, ' ')}</option>
                  {options.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        size="lg"
        className="w-full rounded-xl"
      >
        {saving ? 'Saving...' : 'Save Customizations'}
      </Button>
    </motion.div>
  );
}