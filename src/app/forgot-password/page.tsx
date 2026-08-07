"use client";

import { FormEvent, useState } from "react";

import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
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
    <>
      {toast ? <ToastMessage type={toast.type} message={toast.message} /> : null}

      <AuthShell
        title="Reset your password"
        subtitle={
          isOtpSent
            ? "Enter the 6-digit code we sent, then choose a new password."
            : "We'll email you a 6-digit code. Enter it on the next step to set a new password."
        }
        footer={
          <p>
            Remembered it? <AuthLink href="/">Back to sign in</AuthLink>
          </p>
        }
      >
        {/* Step 1 — request the code. Stays visible after sending so the address
            can be corrected and the code re-requested without a reload. */}
        <form onSubmit={onForgotPassword} className="grid gap-4">
          <div className="ha-field">
            <label className="ha-label" htmlFor="forgot-email">
              Email address
            </label>
            <input
              id="forgot-email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="you@company.com"
              type="email"
              autoComplete="email"
              className="ha-input"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isBusy}
            data-loading={isBusy || undefined}
            className={`ha-btn ha-btn-lg w-full ${isOtpSent ? "ha-btn-secondary" : "ha-btn-primary"}`}
          >
            {isBusy ? "Sending…" : isOtpSent ? "Resend code" : "Send code"}
          </button>
        </form>

        {isOtpSent ? (
          <>
            <div className="my-6 flex items-center gap-3" aria-hidden="true">
              <span className="ha-divider flex-1" />
              <span className="ha-eyebrow">Then</span>
              <span className="ha-divider flex-1" />
            </div>

            <form onSubmit={onResetPassword} className="ha-enter grid gap-4">
              <div className="ha-field">
                <label className="ha-label" htmlFor="reset-email">
                  Email address
                </label>
                <input
                  id="reset-email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  autoComplete="email"
                  className="ha-input"
                  required
                />
              </div>

              <div className="ha-field">
                <label className="ha-label" htmlFor="reset-otp">
                  Verification code
                </label>
                <input
                  id="reset-otp"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  className="ha-input text-center text-lg tracking-[0.5em] tabular-nums"
                  required
                />
                <p className="ha-hint">6 digits, valid for 10 minutes.</p>
              </div>

              <div className="ha-field">
                <label className="ha-label" htmlFor="reset-password">
                  New password
                </label>
                <PasswordInput
                  id="reset-password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="ha-input"
                  required
                />
                <p className="ha-hint">Between 8 and 128 characters.</p>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                data-loading={isBusy || undefined}
                className="ha-btn ha-btn-primary ha-btn-lg mt-1 w-full"
              >
                {isBusy ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        ) : null}
      </AuthShell>
    </>
  );
}
