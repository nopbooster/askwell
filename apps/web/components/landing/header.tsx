import { Show } from "@clerk/nextjs";
import { APP_NAME } from "@askwell/shared";
import { LinkButton } from "./link-button";

export function LandingHeader() {
  return (
    <header className="glass sticky top-0 z-20 border-x-0 border-t-0">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <span className="font-semibold">{APP_NAME}</span>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <LinkButton href="/sign-in" variant="ghost">
              Sign in
            </LinkButton>
            <LinkButton href="/sign-up">Start free</LinkButton>
          </Show>
          <Show when="signed-in">
            <LinkButton href="/dashboard">Go to dashboard</LinkButton>
          </Show>
        </div>
      </div>
    </header>
  );
}
