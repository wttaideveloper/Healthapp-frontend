"use client";

import { FormEvent, useState } from "react";

import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { callApi } from "@/lib/admin/api";

type ToastState = { id: number; type: "success" | "error"; message: string } | null;
type FieldName = "name" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ]*$/;
/** Same format rule as workspace owner-email: local-part @ domain . tld */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_ORDER: FieldName[] = ["name", "email", "password"];
const FIELD_IDS: Record<FieldName, string> = {
    name: "signup-name",
    email: "signup-email",
    password: "signup-password",
};

function describedBy(...ids: Array<string | false | undefined>): string | undefined {
    return ids.filter(Boolean).join(" ") || undefined;
}

function nameError(value: string): string | undefined {
    const normalized = value.trim();
    if (!normalized || !NAME_PATTERN.test(normalized)) {
        return "Name must start with a letter and can include letters, numbers, and spaces.";
    }
    return undefined;
}

function emailError(value: string): string | undefined {
    if (!EMAIL_PATTERN.test(value.trim())) {
        return "Please enter a valid email address.";
    }
    return undefined;
}

function passwordError(value: string): string | undefined {
    if (value.length < 8) {
        return "Password must be at least 8 characters.";
    }
    return undefined;
}

function validateFields(name: string, email: string, password: string): FieldErrors {
    const errors: FieldErrors = {};
    const nextName = nameError(name);
    const nextEmail = emailError(email);
    const nextPassword = passwordError(password);
    if (nextName) errors.name = nextName;
    if (nextEmail) errors.email = nextEmail;
    if (nextPassword) errors.password = nextPassword;
    return errors;
}

function focusFirstInvalidField(errors: FieldErrors): void {
    const field = FIELD_ORDER.find((key) => errors[key]);
    if (field) document.getElementById(FIELD_IDS[field])?.focus();
}

/**
 * Workspace admin sign-up.
 *
 * Same endpoint and approval notice as before. Field checks run in the form
 * before `auth/register` is called, and toasts auto-dismiss like the rest of
 * the console.
 */
export function WorkspaceAuthScreen() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isBusy, setIsBusy] = useState(false);
    const [toast, setToast] = useState<ToastState>(null);
    const [errors, setErrors] = useState<FieldErrors>({});

    function clearErrorWhenValid(field: FieldName, message: string | undefined): void {
        setErrors((current) => {
            if (!current[field] || message) return current;
            const next = { ...current };
            delete next[field];
            return next;
        });
    }

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const nextErrors = validateFields(name, email, password);
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            setToast(null);
            focusFirstInvalidField(nextErrors);
            return;
        }

        setErrors({});
        setIsBusy(true);
        setToast(null);

        try {
            await callApi("auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
            });

            setToast({
                id: Date.now(),
                type: "success",
                message: "Registered successfully. Your account requires admin approval before you can sign in.",
            });
            setName("");
            setEmail("");
            setPassword("");
        } catch (e) {
            setToast({
                id: Date.now(),
                type: "error",
                message: (e as Error)?.message || "Registration failed",
            });
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <>
            {toast ? (
                <ToastMessage
                    key={toast.id}
                    type={toast.type}
                    message={toast.message}
                    onDismiss={() => setToast(null)}
                />
            ) : null}

            <AuthShell
                title="Create your account"
                subtitle="Register as a workspace administrator. A platform admin approves the account before first sign-in."
                footer={
                    <p>
                        Already have an account? <AuthLink href="/">Sign in</AuthLink>
                    </p>
                }
            >
                <form noValidate onSubmit={onSubmit} className="grid gap-4">
                    <div className="ha-field">
                        <label className="ha-label" htmlFor="signup-name">
                            Full name
                        </label>
                        <input
                            id="signup-name"
                            value={name}
                            onChange={(e) => {
                                const value = e.target.value;
                                setName(value);
                                clearErrorWhenValid("name", nameError(value));
                            }}
                            placeholder="Jane Doe"
                            autoComplete="name"
                            className="ha-input"
                            aria-invalid={errors.name ? true : undefined}
                            aria-describedby={describedBy(
                                "signup-name-hint",
                                errors.name && "signup-name-error",
                            )}
                        />
                        <p id="signup-name-hint" className="ha-hint">
                            Letters, numbers and spaces. Must start with a letter.
                        </p>
                        {errors.name ? (
                            <p id="signup-name-error" role="alert" className="ha-error-text">
                                {errors.name}
                            </p>
                        ) : null}
                    </div>

                    <div className="ha-field">
                        <label className="ha-label" htmlFor="signup-email">
                            Work email
                        </label>
                        <input
                            id="signup-email"
                            value={email}
                            onChange={(e) => {
                                const value = e.target.value;
                                setEmail(value);
                                clearErrorWhenValid("email", emailError(value));
                            }}
                            placeholder="you@company.com"
                            type="email"
                            autoComplete="email"
                            className="ha-input"
                            aria-invalid={errors.email ? true : undefined}
                            aria-describedby={describedBy(errors.email && "signup-email-error")}
                        />
                        {errors.email ? (
                            <p id="signup-email-error" role="alert" className="ha-error-text">
                                {errors.email}
                            </p>
                        ) : null}
                    </div>

                    <div className="ha-field">
                        <label className="ha-label" htmlFor="signup-password">
                            Password
                        </label>
                        <PasswordInput
                            id="signup-password"
                            value={password}
                            onChange={(e) => {
                                const value = e.target.value;
                                setPassword(value);
                                clearErrorWhenValid("password", passwordError(value));
                            }}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            className="ha-input"
                            minLength={8}
                            aria-invalid={errors.password ? true : undefined}
                            aria-describedby={describedBy(errors.password && "signup-password-error")}
                        />
                        {errors.password ? (
                            <p id="signup-password-error" role="alert" className="ha-error-text">
                                {errors.password}
                            </p>
                        ) : null}
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
