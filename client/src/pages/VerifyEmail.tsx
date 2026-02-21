import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const { verifyEmail, resendVerification } = useAuth();
  const [email, setEmail] = useState(new URLSearchParams(window.location.search).get("email") || "");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);

  useEffect(() => {
    if (!token) return;
    const run = async () => {
      setLoading(true);
      try {
        await verifyEmail(token);
        setVerified(true);
        toast.success("Email verified");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Verification failed");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token, verifyEmail]);

  const onResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resendVerification(email);
      toast.success("If account exists, verification email was sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-8">
        <h1 className="text-xl font-semibold text-[#0F172A]">Email verification</h1>
        {verified ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">Your email is verified. You can login now.</p>
            <Button className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5]" onClick={() => navigate("/login")}>
              Go to login
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onResend}>
            <p className="text-sm text-slate-500">Didn&apos;t get the email? Enter your address to resend.</p>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required className="h-11" />
            <Button type="submit" className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5]" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Resend verification"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
