"use client";

import { FormEvent, useState } from "react";

import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { callApi } from "@/lib/admin/api";

type ToastState = { type: "success" | "error"; message: string } | null;
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ]*$/;

/**
 * Workspace admin sign-up.
 *
 * Registration logic is untouched — same endpoint, same name validation, same
 * approval notice. Presentation moves onto the shared auth frame.
 */
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
            const normalizedName = name.trim();
            if (!NAME_PATTERN.test(normalizedName)) {
                throw new Error("Name must start with a letter and can include letters, numbers, and spaces.");
            }

            await callApi("auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: normalizedName, email, password }),
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
        <>
            {toast ? <ToastMessage type={toast.type} message={toast.message} /> : null}

            <AuthShell
                title="Create your account"
                subtitle="Register as a workspace administrator. A platform admin approves the account before first sign-in."
                footer={
                    <p>
                        Already have an account? <AuthLink href="/">Sign in</AuthLink>
                    </p>
                }
            >
                <form onSubmit={onSubmit} className="grid gap-4">
                    <div className="ha-field">
                        <label className="ha-label" htmlFor="signup-name">
                            Full name
                        </label>
                        <input
                            id="signup-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Jane Doe"
                            pattern="[A-Za-z][A-Za-z0-9 ]*"
                            title="Name must start with a letter and can include letters, numbers, and spaces."
                            autoComplete="name"
                            className="ha-input"
                            required
                        />
                        <p className="ha-hint">Letters, numbers and spaces. Must start with a letter.</p>
                    </div>

                    <div className="ha-field">
                        <label className="ha-label" htmlFor="signup-email">
                            Work email
                        </label>
                        <input
                            id="signup-email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            type="email"
                            autoComplete="email"
                            className="ha-input"
                            required
                        />
                    </div>

                    <div className="ha-field">
                        <label className="ha-label" htmlFor="signup-password">
                            Password
                        </label>
                        <PasswordInput
                            id="signup-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            className="ha-input"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isBusy}
                        data-loading={isBusy || undefined}
                        className="ha-btn ha-btn-primary ha-btn-lg mt-1 w-full"
                    >
                        {isBusy ? "Creating account…" : "Create account"}
                    </button>
                </form>
            </AuthShell>
        </>
    );
}

export default WorkspaceAuthScreen;
