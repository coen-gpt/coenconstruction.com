import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ARMeasurementTool from "@/components/estimator/ARMeasurementTool";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";

export default function QuickARMeasure() {
  const navigate = useNavigate();
  const { brandColor } = useCompanyBrand();

  const dummyProject = {
    id: "quick-measure",
    rooms: [],
  };

  const handleSave = (measurements) => {
    // Log quick measurements — user can manually add to a project later
    console.log("Quick measurements captured:", measurements);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => navigate("/estimator")}
          className="text-gray-400 hover:opacity-70 transition-opacity"
          style={{ color: brandColor }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-secondary">Quick AR Measure</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Quickly capture room dimensions and areas using AR. Save your measurements for later or apply them directly to a project.
      </p>
      
      <ARMeasurementTool project={dummyProject} onSave={handleSave} />
    </div>
  );
}