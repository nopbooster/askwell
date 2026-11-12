import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@askwell/shared"],
  // Don't let `next dev` write apps/web/AGENTS.md; team rules live in the root CLAUDE.md.
  agentRules: false,
  async headers() {
    return [
      {
        // The loader script that customers paste into their sites.
        source: "/widget.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=300" }],
      },
    ];
  },
};

export default nextConfig;
