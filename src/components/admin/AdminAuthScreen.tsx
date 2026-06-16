import { FormEvent } from "react";

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

export function AdminAuthScreen(props: AdminAuthScreenProps) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 md:px-10">
      {props.toast ? <ToastMessage type={props.toast.type} message={props.toast.message} /> : null}

      <section className="mb-10 rounded-3xl border border-border/80 bg-card/90 p-8 shadow-[0_16px_50px_rgba(15,23,42,0.10)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-accent">HealthAge Admin Console</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground md:text-4xl">Workspace Access Control Plane</h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground/75">
          Sign in as platform admin or workspace admin.
        </p>
      </section>

      <div className="grid gap-6">
        <form onSubmit={props.onLogin} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Login</h2>
          <p className="mt-1 text-sm text-foreground/70">Sign in with your account.</p>

          <div className="mt-5 grid gap-3">
            <input
              value={props.loginEmail}
              onChange={(event) => props.setLoginEmail(event.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              placeholder="admin@conference.org"
              type="email"
              required
            />
            <PasswordInput
              value={props.loginPassword}
              onChange={(event) => props.setLoginPassword(event.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              placeholder="Password"
              required
            />
          </div>

          <button
            disabled={props.isBusy}
            className="mt-5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
          >
            {props.isBusy ? "Please wait..." : "Sign In"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-sm text-foreground/70">
        Forgot password?{" "}
        <a href="/forgot-password" className="text-accent underline">
          Reset here
        </a>
      </p>

      <p className="mt-2 text-sm text-foreground/70">
        Need to create a workspace admin?{" "}
        <a href="/workspace-admin" className="text-accent underline">
          Sign up
        </a>
      </p>

    </main>
  );
}
