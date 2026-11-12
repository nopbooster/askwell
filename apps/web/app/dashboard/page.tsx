import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <UserButton />
      </div>
    </main>
  );
}
