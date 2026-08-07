import { FormEvent } from "react";

import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { ToastState } from "@/types/admin";

type AdminAuthScreenProps = {
  toast: ToastState;
  isBusy: boolean;
  loginEmail: string;
  setLoginEmail: (value: string) => void;
  loginPassword: string;
  setLoginPassword: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

/**
 * Sign-in.
 *
 * Behaviour is unchanged — same handler, same two fields, same links. Only the
 * presentation moves onto the shared auth frame and the design-system controls.
 */
export function AdminAuthScreen(props: AdminAuthScreenProps) {
  return (
    <>
      {props.toast ? <ToastMessage type={props.toast.type} message={props.toast.message} /> : null}

      <AuthShell
        title="Sign in"
        subtitle="Access the workspace access control plane as a platform or workspace administrator."
        footer={
          <>
            <p>
              Forgot your password? <AuthLink href="/forgot-password">Reset it here</AuthLink>
            </p>
            <p>
              Need a workspace admin account? <AuthLink href="/workspace-admin">Sign up</AuthLink>
            </p>
          </>
        }
      >
        <form onSubmit={props.onLogin} className="grid gap-4">
          <div className="ha-field">
            <label className="ha-label" htmlFor="login-email">
              Email address
            </label>
            <input
              id="login-email"
              value={props.loginEmail}
              onChange={(event) => props.setLoginEmail(event.target.value)}
              className="ha-input"
              placeholder="you@company.com"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="ha-field">
            <label className="ha-label" htmlFor="login-password">
              Password
            </label>
            <PasswordInput
              id="login-password"
              value={props.loginPassword}
              onChange={(event) => props.setLoginPassword(event.target.value)}
              className="ha-input"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            disabled={props.isBusy}
            data-loading={props.isBusy || undefined}
            className="ha-btn ha-btn-primary ha-btn-lg mt-1 w-full"
            type="submit"
          >
            {props.isBusy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </AuthShell>
    </>
  );
}
