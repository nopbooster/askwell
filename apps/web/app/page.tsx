import { APP_NAME } from "@askwell/shared";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-semibold">{APP_NAME}</h1>
    </main>
  );
}
