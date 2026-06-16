"use client";

import { FormEvent, useState } from "react";

import { PasswordInput } from "@/components/ui/PasswordInput";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { callApi } from "@/lib/admin/api";

type ToastState = { type: "success" | "error"; message: string } | null;

export default function ForgotPasswordPage() {
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [isOtpSent, setIsOtpSent] = useState(false);

  async function onForgotPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    setToast(null);
    try {
      const response = await callApi<{ ok: boolean; message: string }>("auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setToast({ type: "success", message: response.message || "If an account exists, an OTP has been sent." });
      setIsOtpSent(true);
      if (!resetEmail) {
        setResetEmail(forgotEmail);
      }
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Failed to send OTP" });
    } finally {
      setIsBusy(false);
    }
  }

  async function onResetPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    setToast(null);
    try {
      if (!/^\d{6}$/.test(resetOtp)) throw new Error("OTP must be exactly 6 digits.");
      if (resetNewPassword.length < 8 || resetNewPassword.length > 128) throw new Error("Password must be 8 to 128 characters.");

      const response = await callApi<{ ok: boolean; message: string }>("auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          otp: resetOtp,
          newPassword: resetNewPassword,
        }),
      });
      setToast({ type: "success", message: response.message || "Password updated successfully." });
      setResetOtp("");
      setResetNewPassword("");
      setIsOtpSent(false);
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Failed to reset password" });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      {toast ? <ToastMessage type={toast.type} message={toast.message} /> : null}

      <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Reset Password</h1>
        <p className="mt-1 text-sm text-foreground/70">Request OTP first, then reset using email + OTP + new password.</p>

        <form onSubmit={onForgotPassword} className="mt-6 grid gap-3">
          <input
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="user@example.com"
            type="email"
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={isBusy}
            className="rounded-xl bg-accent-2 px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
          >
            {isBusy ? "Please wait..." : "Send OTP"}
          </button>
        </form>

        {isOtpSent ? (
          <form onSubmit={onResetPassword} className="mt-6 grid gap-3">
            <input
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              required
            />
            <input
              value={resetOtp}
              onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              pattern="\d{6}"
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              required
            />
            <PasswordInput
              value={resetNewPassword}
              onChange={(e) => setResetNewPassword(e.target.value)}
              placeholder="New password"
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isBusy ? "Please wait..." : "Reset Password"}
            </button>
          </form>
        ) : null}

        <p className="mt-5 text-sm text-foreground/70">
          Back to login? <a href="/" className="text-accent underline">Sign in</a>
        </p>
      </section>
    </main>
  );
}
