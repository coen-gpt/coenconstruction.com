import { Navigate } from "react-router-dom";

// The unified dashboard now lives at /estimator/dashboard
export default function AdminDashboard() {
  return <Navigate to="/estimator/dashboard" replace />;
}