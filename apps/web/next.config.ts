import type { NextConfig } from "next";

/**
 * Every path except the widget iframe (`/embed`, `/embed/…`). `/embedded-docs` still matches:
 * the lookahead only skips `embed` as a whole first segment.
 */
export const NOT_EMBED_SOURCE = "/:path((?!embed(?:/|$)).*)";
/** Every path, including `/` (`/:path*` would skip `/`). */
export const ALL_PATHS_SOURCE = "/(.*)";

const nextConfig: NextConfig = {
  transpilePackages: ["@askwell/shared"],
  // Don't let `next dev` write apps/web/AGENTS.md; team rules live in the root CLAUDE.md.
  agentRules: false,
  async headers() {
    return [
      {
        // project.md §9 Clickjacking: only /embed may be framed by other sites. Not a full CSP on
        // purpose (it would break Clerk, Stripe and PostHog), and no X-Frame-Options anywhere:
        // it can't make an exception for /embed and would fight frame-ancestors.
        source: NOT_EMBED_SOURCE,
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
      {
        source: ALL_PATHS_SOURCE,
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The loader script that customers paste into their sites.
        source: "/widget.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=300" }],
      },
    ];
  },
};

export default nextConfig;
