"use client";

import { FormEvent, useState } from "react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { callApi } from "@/lib/admin/api";

type ToastState = { type: "success" | "error"; message: string } | null;

export function WorkspaceAuthScreen() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [toast, setToast] = useState<ToastState>(null);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsBusy(true);
        setToast(null);

        try {
            await callApi("auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            setToast({ type: "success", message: "Registered successfully. Your account requires admin approval before you can sign in." });
            setName("");
            setEmail("");
            setPassword("");
        } catch (e) {
            setToast({ type: "error", message: (e as Error)?.message || "Registration failed" });
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
            {toast ? <ToastMessage type={toast.type} message={toast.message} /> : null}

            <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
                <h1 className="text-2xl font-semibold">Workspace Admin Signup</h1>
                <p className="mt-1 text-sm text-foreground/70">Create a workspace admin account.</p>

                <form onSubmit={onSubmit} className="mt-6 grid gap-3">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full name"
                        className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                        required
                    />

                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        type="email"
                        className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                        required
                    />

                    <PasswordInput
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                        required
                    />

                    <button
                        type="submit"
                        disabled={isBusy}
                        className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        {isBusy ? "Please wait..." : "Sign Up"}
                    </button>

                    <p className="mt-3 text-sm text-foreground/70">Already have an account? <a href="/" className="text-accent underline">Sign in</a></p>
                </form>
            </section>
        </main>
    );
}

export default WorkspaceAuthScreen;
