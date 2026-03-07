import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthApiError, useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function normalizeRecoveryUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleRecovery, setGoogleRecovery] = useState<{ message: string; recoveryUrl: string } | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGoogleRecovery(null);
    setVerifyMessage(null);
    try {
      await requestPasswordReset(email);
      toast.success("If account exists, reset instructions were sent");
      navigate("/login");
    } catch (error) {
      if (isAuthApiError(error)) {
        if (error.code === "USE_GOOGLE_ACCOUNT_RECOVERY") {
          const recoveryUrl = normalizeRecoveryUrl(error.recoveryUrl);
          if (recoveryUrl) {
            setGoogleRecovery({
              message: error.message || "Use Google account recovery for this account.",
              recoveryUrl,
            });
            toast.error("Use Google account recovery.");
          } else {
            toast.error(error.message || "Google account recovery is required");
          }
        } else if (error.code === "EMAIL_NOT_VERIFIED") {
          setVerifyMessage(error.message || "Please verify your email first.");
          toast.error("Email not verified.");
        } else {
          toast.error(error.message || "Request failed");
        }
      } else {
        toast.error(error instanceof Error ? error.message : "Request failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-8">
        <h1 className="text-xl font-semibold text-[#0F172A]">Forgot password</h1>
        <p className="text-sm text-slate-500 mt-1">Enter your email to receive reset instructions.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            required
            className="h-11"
          />
          <Button type="submit" className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5]" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset email"}
          </Button>
        </form>

        {googleRecovery && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-900">{googleRecovery.message}</p>
            <a
              href={googleRecovery.recoveryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Continue with Google account recovery
            </a>
          </div>
        )}

        {verifyMessage && (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <p className="text-xs text-sky-900">{verifyMessage}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-2 h-9 w-full border-sky-300 text-sky-900 hover:bg-sky-100"
              onClick={() => navigate(`/verify-email?email=${encodeURIComponent(email)}`)}
            >
              Verify email
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
