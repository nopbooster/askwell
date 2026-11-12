/** Shown when the key is bad or unknown, or the config could not be loaded. */
export function Unavailable() {
  return (
    <div
      className="grid h-dvh place-items-center bg-canvas px-6 text-center"
      role="alert"
    >
      <div>
        <h1 className="text-base font-semibold text-fg">Chat unavailable</h1>
        <p className="mt-1 text-sm text-fg-muted">
          This chat isn&apos;t available right now. Please try again later.
        </p>
      </div>
    </div>
  );
}
