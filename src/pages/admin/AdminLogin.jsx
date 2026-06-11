import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import BrandLogo from "@/components/shared/BrandLogo";
import InstallAppPrompt from "@/components/shared/InstallAppPrompt";

export default function AdminLogin({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | forgot | forgotSent
  const [resetLink, setResetLink] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("adminAuth", { action: "login", email, password, turnstile_token: turnstileToken });
      if (res.data?.error) {
        setError(res.data.error);
        setTurnstileReset((n) => n + 1); // tokens are single-use — issue a fresh challenge
      } else {
        onLogin(res.data);
      }
    } catch (err) {
      setError("Login failed. Please check your credentials and try again.");
      setTurnstileReset((n) => n + 1);
    }
    setLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError("");
    setResetLink("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("adminAuth", { action: "forgot", email });
      if (res.data?.link) setResetLink(res.data.link);
      setMode("forgotSent");
    } catch {
      setError("We couldn't send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary to-secondary/95 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-3">
            <BrandLogo className="h-12" />
          </div>
          <h1 className="text-2xl font-bold text-secondary">Admin</h1>
          <p className="text-gray-400 text-sm mt-1">
            {mode === "login" ? "Sign in to continue" : mode === "forgot" ? "Reset your password" : "Check your email"}
          </p>
        </div>

        {mode === "forgotSent" ? (
          <div className="text-center">
            {resetLink ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-sm text-left">
                <p className="font-semibold text-yellow-800 mb-2">Email could not be delivered automatically.</p>
                <p className="text-yellow-700 mb-3 text-xs">Copy and share this password reset link directly with the user:</p>
                <div className="bg-white border border-yellow-200 rounded p-2 break-all text-xs font-mono text-gray-700 select-all mb-2">{resetLink}</div>
                <button
                  onClick={() => { navigator.clipboard.writeText(resetLink); }}
                  className="text-xs bg-yellow-700 text-white px-3 py-1.5 rounded hover:bg-yellow-800 transition-colors"
                >
                  Copy Link
                </button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6 text-sm text-green-700">
                If that email exists in our system, you'll receive a reset link shortly.
              </div>
            )}
            <button onClick={() => { setMode("login"); setResetLink(""); }} className="text-sm text-primary font-semibold hover:underline">
              ← Back to sign in
            </button>
          </div>
        ) : mode === "forgot" ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? "Sending..." : <><ArrowRight className="w-4 h-4" /> Send Reset Link</>}
            </button>
            <button type="button" onClick={() => setMode("login")} className="w-full text-sm text-gray-500 hover:text-gray-700 text-center">
              ← Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <TurnstileWidget
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
              resetSignal={turnstileReset}
            />

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? "Signing in..." : <><ArrowRight className="w-4 h-4" /> Sign In</>}
            </button>

            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); }}
              className="w-full text-sm text-gray-400 hover:text-primary transition-colors text-center"
            >
              Forgot password?
            </button>
          </form>
        )}
      </div>
      <InstallAppPrompt />
    </div>
  );
}