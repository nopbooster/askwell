import Link from "next/link";
import { APP_NAME } from "@askwell/shared";

export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-sm text-fg-muted">
        <span>
          © {new Date().getFullYear()} {APP_NAME}
        </span>
        <Link href="/sign-in" className="hover:text-fg">
          Sign in
        </Link>
      </div>
    </footer>
  );
}
