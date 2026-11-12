import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

// Same look as components/ui Button, for links.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg shadow-raised hover:opacity-90",
  secondary: "glass text-fg hover:bg-surface-strong",
  ghost: "text-fg hover:bg-surface",
};

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
