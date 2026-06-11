import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Lock, CheckCircle } from "lucide-react";

export default function AdminSetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [role, setRole] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("adminAuth", { action: "setPassword", token, password });
      if (res.data?.error) {
        setError(res.data.error);
      } else {
        setRole(res.data?.role || "");
        setDone(true);
      }
    } catch (err) {
      setError("Something went wrong. Please try again or contact your administrator.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary to-secondary/95 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <p className="text-red-500 font-semibold">Invalid or missing token.</p>
          <a href="/admin" className="text-primary text-sm mt-4 inline-block hover:underline">← Go to Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary to-secondary/95 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
        <div className="mb-6 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            {done ? <CheckCircle className="w-6 h-6 text-green-500" /> : <Lock className="w-6 h-6 text-primary" />}
          </div>
          <h1 className="text-2xl font-bold text-secondary">{done ? "Password Set!" : "Set Your Password"}</h1>
        </div>

        {done ? (
          <div className="text-center">
            <p className="text-gray-600 text-sm mb-6">
              {role === "field_crew"
                ? "Your password has been set. Sign in to the crew app — your time clock, tasks, and receipts."
                : "Your password has been set. Sign in and you'll be taken to your workspace."}
            </p>
            <a href={role === "field_crew" ? "/field" : "/admin"} className="block w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors text-center">
              {role === "field_crew" ? "Open the Crew App →" : "Sign In →"}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Saving..." : "Set Password & Sign In"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}