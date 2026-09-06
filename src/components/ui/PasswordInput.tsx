"use client";

import { ChangeEvent, useState } from "react";

import { Icon } from "@/components/ui/Icon";

type PasswordInputProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  /** Enables `<label htmlFor>` association. */
  id?: string;
  autoComplete?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * Password field with a reveal toggle.
 *
 * The toggle uses the shared `Icon` set rather than local SVG so its stroke
 * weight and geometry match every other icon in the product — the previous
 * hand-rolled eyes were drawn at a different stroke width and read heavier than
 * their neighbours.
 */
export function PasswordInput(props: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={props.id}
        value={props.value}
        onChange={props.onChange}
        className={`${props.className ?? "ha-input"} w-full pr-10`}
        placeholder={props.placeholder}
        type={isVisible ? "text" : "password"}
        required={props.required}
        minLength={props.minLength}
        autoComplete={props.autoComplete}
        aria-invalid={props["aria-invalid"]}
        aria-describedby={props["aria-describedby"]}
      />
      <button
        type="button"
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[var(--radius-md)] text-[color:var(--text-subtle)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]"
      >
        <Icon name={isVisible ? "eyeOff" : "eye"} size={16} />
      </button>
    </div>
  );
}
