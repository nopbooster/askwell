import type { ComponentPropsWithoutRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg shadow-raised hover:opacity-90",
  secondary: "glass text-fg hover:bg-surface-strong",
  ghost: "text-fg hover:bg-surface",
};

export type ButtonProps = ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant };

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
