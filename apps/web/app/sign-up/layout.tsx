import type { ReactNode } from "react";
import { AuthProvider } from "../../components/auth/auth-provider";

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthProvider>{children}</AuthProvider>;
}
