import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
      toast.success("If account exists, reset instructions were sent");
      navigate("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
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
      </div>
    </div>
  );
}
