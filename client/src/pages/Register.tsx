import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { isAuthApiError, useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Layers, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

type RegisterHint =
  | { type: "google_login"; message: string }
  | { type: "verify_email"; message: string; email: string };

export default function Register() {
  const [, navigate] = useLocation();
  const { register, loginWithGoogle } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hint, setHint] = useState<RegisterHint | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    setHint(null);

    try {
      await register(username, email, password);
      toast.success("Account created. Please verify your email.");
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      if (isAuthApiError(error)) {
        if (error.code === "USE_GOOGLE_LOGIN") {
          setHint({
            type: "google_login",
            message: error.message || "This email is linked to Google sign-in.",
          });
          toast.error("This email is linked to Google. Continue with Google.");
        } else if (error.code === "EMAIL_NOT_VERIFIED") {
          setHint({
            type: "verify_email",
            message: error.message || "Please verify your email first.",
            email: error.email || email,
          });
          toast.error("Email not verified.");
        } else {
          toast.error(error.message || "Registration failed");
        }
      } else {
        toast.error(error instanceof Error ? error.message : "Registration failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current) return;
    const scriptId = "google-identity-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderGoogle = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) return;
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp: any) => {
          if (!resp?.credential) return;
          try {
            await loginWithGoogle(resp.credential);
            toast.success("Welcome!");
            navigate("/dashboard");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Google signup failed");
          }
        },
      });
      const mountNode = googleBtnRef.current;
      if (!mountNode) return;
      mountNode.innerHTML = "";
      google.accounts.id.renderButton(mountNode, {
        theme: "outline",
        size: "large",
        width: 340,
        text: "continue_with",
      });
    };

    if (existing) {
      renderGoogle();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogle;
    document.body.appendChild(script);
  }, [googleClientId, loginWithGoogle, navigate]);

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col">
      {/* Header */}
      <header className="py-10">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">TaskFlow <span className="text-indigo-400 font-medium text-sm">CRM</span></span>
        </div>
      </header>

      {/* Register Form */}
      <div className="flex-1 flex items-start justify-center pt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm px-4"
        >
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-8">
            <h1 className="text-lg font-bold text-[#0F172A] text-center mb-1">
              Create your account
            </h1>
            <p className="text-sm text-[#475569] text-center mb-6">
              Start managing your pipeline with TaskFlow CRM
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">Full name</label>
                <Input
                  id="username"
                  type="text"
                  placeholder="John Doe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-11 border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:ring-[#6366F1] rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:ring-[#6366F1] rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">Password</label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password (6+ characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:ring-[#6366F1] rounded-lg"
                />
              </div>

              <p className="text-xs text-[#94A3B8] leading-relaxed">
                By signing up, you confirm that you've read and accepted our{" "}
                <a href="#" className="text-[#6366F1] hover:underline">Terms of Service</a> and{" "}
                <a href="#" className="text-[#6366F1] hover:underline">Privacy Policy</a>.
              </p>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold rounded-lg shadow-md shadow-indigo-500/25"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            {hint?.type === "google_login" && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-900">{hint.message}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-9 w-full border-amber-300 text-amber-900 hover:bg-amber-100"
                  disabled={!googleClientId}
                  onClick={() => {
                    googleBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  Continue with Google
                </Button>
              </div>
            )}

            {hint?.type === "verify_email" && (
              <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
                <p className="text-xs text-sky-900">{hint.message}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-9 w-full border-sky-300 text-sky-900 hover:bg-sky-100"
                  onClick={() => navigate(`/verify-email?email=${encodeURIComponent(hint.email)}`)}
                >
                  Verify email
                </Button>
              </div>
            )}

            <div className="mt-6 text-center">
              <span className="text-sm text-[#475569]">Already have an account? </span>
              <button
                onClick={() => navigate("/login")}
                className="text-sm text-[#6366F1] hover:text-[#4F46E5] font-medium"
              >
                Log in
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-[#0F172A] text-[#94A3B8]">OR</span>
            </div>
          </div>

          {/* Social Login Options */}
          <div className="space-y-3 flex justify-center">
            {googleClientId ? (
              <div ref={googleBtnRef} />
            ) : (
              <div className="w-full text-center text-xs text-[#94A3B8] bg-white/5 rounded-lg py-3">
                Google login is not configured
              </div>
            )}
          </div>

          {/* Back to home */}
          <div className="mt-8 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-sm text-[#94A3B8] hover:text-white transition-colors"
            >
              &larr; Back to home
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-[#475569]">
          Privacy Policy &middot; Terms of Service
        </p>
      </footer>
    </div>
  );
}
