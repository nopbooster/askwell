import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@askwell/shared";
import { AuthProvider } from "../../components/auth/auth-provider";
import { PlanBadge } from "../../components/dashboard/plan-badge";
import { Sidebar } from "../../components/dashboard/sidebar";
import { ensureAccount, getOwnerPlan } from "../../lib/accounts";
import { listOwnedProjects } from "../../lib/projects";

export const metadata: Metadata = {
  title: { default: `Dashboard · ${APP_NAME}`, template: `%s · ${APP_NAME}` },
};

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  await ensureAccount();
  const [plan, projects] = await Promise.all([getOwnerPlan(), listOwnedProjects()]);

  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar
          badge={<PlanBadge state={plan} />}
          projects={projects.map(({ id, name }) => ({ id, name }))}
        />
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </AuthProvider>
  );
}
