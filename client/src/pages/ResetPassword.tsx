import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Missing reset token");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      toast.success("Password reset successful");
      navigate("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-8">
        <h1 className="text-xl font-semibold text-[#0F172A]">Set new password</h1>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" required className="h-11" />
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" required className="h-11" />
          <Button type="submit" className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5]" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
