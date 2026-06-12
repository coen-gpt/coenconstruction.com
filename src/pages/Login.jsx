import usePageTitle from "@/hooks/usePageTitle";
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import BrandLogo from "@/components/shared/BrandLogo";

export default function Login() {
  usePageTitle("Sign In");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = from;
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", from);
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#0f1a24" }}>
      {/* Left branding panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12"
        style={{ background: "#1B2B3A" }}
      >
        <div className="flex items-center gap-3">
          <BrandLogo onDark className="h-12" />
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Build smarter.<br />Manage better.
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Your complete operations platform for estimating, project management, and field crew coordination.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: "#E35235" }}>500+</div>
            <div className="text-slate-400 text-sm">Projects Completed</div>
          </div>
          <div className="w-px h-10 bg-slate-600" />
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: "#E35235" }}>15+</div>
            <div className="text-slate-400 text-sm">Years in Business</div>
          </div>
          <div className="w-px h-10 bg-slate-600" />
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: "#E35235" }}>100%</div>
            <div className="text-slate-400 text-sm">Client Focused</div>
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <BrandLogo onDark className="h-12" />
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
            <p className="text-slate-400">Sign in to your account to continue</p>
          </div>

          <div
            className="rounded-2xl p-8"
            style={{ background: "#1B2B3A", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Button
              variant="outline"
              className="w-full h-12 text-sm font-medium mb-6"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: "white" }}
              onClick={handleGoogle}
            >
              <GoogleIcon className="w-5 h-5 mr-2" />
              Continue with Google
            </Button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-3 text-slate-500" style={{ background: "#1B2B3A" }}>or</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(227,82,53,0.15)", color: "#f87171", border: "1px solid rgba(227,82,53,0.3)" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@coenconstruction.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", focusRingColor: "#E35235" }}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
                  <Link to="/forgot-password" className="text-xs hover:underline" style={{ color: "#E35235" }}>
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    required
                  />
                </div>
              </div>
              <TurnstileWidget
                theme="dark"
                onVerify={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
              />
              <button
                type="submit"
                disabled={loading || !turnstileToken}
                className="w-full h-12 rounded-lg font-semibold text-white text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                style={{ background: "#E35235" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}