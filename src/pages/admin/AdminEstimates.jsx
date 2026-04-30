import { Link } from "react-router-dom";
import { ArrowRight, Calculator } from "lucide-react";

export default function AdminEstimates() {
  return (
    <div className="p-4 sm:p-6 md:p-10 flex flex-col items-center justify-center text-center min-h-[60vh] max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="w-12 sm:w-16 h-12 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3 sm:mb-5">
        <Calculator className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
      </div>
      <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-secondary dark:text-gray-100 mb-2">Estimating Suite</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-4 sm:mb-6 text-xs sm:text-sm md:text-base">
        The full estimating suite has moved. Access projects, walkthroughs, AI-powered estimates, material take-offs, and more.
      </p>
      <Link
        to="/estimator"
        className="bg-primary text-white font-bold px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center touch-manipulation"
      >
        Open Estimating Suite <ArrowRight className="w-4 h-4" />
      </Link>
      </div>
      );
      }