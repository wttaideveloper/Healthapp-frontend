"use client";

import { ChangeEvent, useState } from "react";

type PasswordInputProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
};

export function PasswordInput(props: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input
        value={props.value}
        onChange={props.onChange}
        className={`${props.className ?? ""} w-full pr-11`}
        placeholder={props.placeholder}
        type={isVisible ? "text" : "password"}
        required={props.required}
      />
      <button
        type="button"
        aria-label={isVisible ? "Hide password" : "Show password"}
        onClick={() => setIsVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-foreground/70 transition hover:text-foreground"
      >
        {isVisible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12C3.9 8.6 7.4 6.5 12 6.5C16.6 6.5 20.1 8.6 22 12C20.1 15.4 16.6 17.5 12 17.5C7.4 17.5 3.9 15.4 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12C3.9 8.6 7.4 6.5 12 6.5C16.6 6.5 20.1 8.6 22 12C20.1 15.4 16.6 17.5 12 17.5C7.4 17.5 3.9 15.4 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 4L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
