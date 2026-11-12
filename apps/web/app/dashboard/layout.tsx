import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@askwell/shared";
import { Sidebar } from "../../components/dashboard/sidebar";

export const metadata: Metadata = {
  title: { default: `Dashboard · ${APP_NAME}`, template: `%s · ${APP_NAME}` },
};

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
