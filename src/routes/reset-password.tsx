import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Cloud & Core" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      toast("Use at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] member-shell flex items-center justify-center px-6">
      <div className="w-full max-w-sm member-card p-8">
        <p className="member-eyebrow">Recover access</p>
        <h1 className="font-display italic text-[2.25rem] leading-[1.05] text-navy mt-3">
          A new <span className="italic">password</span>
        </h1>
        <div className="mt-4 h-px w-12 bg-gold" />
        <p className="text-sm text-slate mt-4">
          {ready ? "Choose something memorable." : "Validating your reset link…"}
        </p>

        <form onSubmit={submit} className="space-y-4 mt-7">
          <label className="block">
            <span className="field-label">New password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={!ready}
                autoComplete="new-password"
                className="editorial-input focus:editorial-input-focus pr-10 disabled:opacity-60"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-navy"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="field-label">Confirm password</span>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                disabled={!ready}
                autoComplete="new-password"
                className="editorial-input focus:editorial-input-focus pr-10 disabled:opacity-60"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-navy"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            disabled={busy || !ready}
            className={
              busy || !ready
                ? "cta-navy cta-navy-disabled mt-3"
                : "cta-navy hover:cta-navy-hover mt-3"
            }
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
