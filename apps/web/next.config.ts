import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@askwell/shared"],
  // Don't let `next dev` write apps/web/AGENTS.md; team rules live in the root CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
