import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
export const MAX_GZIP_BYTES = 5 * 1024;

// `@askwell/shared` re-exports zod schemas we must not ship. Telling esbuild its modules are
// side-effect free lets it drop everything the loader does not use.
const shared = {
  name: "shared-side-effect-free",
  setup(b) {
    b.onResolve({ filter: /^@askwell\/shared$|^\.\// }, async (args) => {
      if (args.pluginData === "skip") return null;
      const r = await b.resolve(args.path, {
        resolveDir: args.resolveDir,
        kind: args.kind,
        importer: args.importer,
        pluginData: "skip",
      });
      if (r.errors.length || !r.path.includes("/packages/shared/")) return r;
      return { ...r, sideEffects: false };
    });
  },
};

/** Bundles the loader in memory. Returns the code and its gzipped size. */
export async function buildWidget() {
  const result = await build({
    entryPoints: [resolve(root, "src/index.ts")],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2018",
    write: false,
    legalComments: "none",
    plugins: [shared],
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  return { code, gzipBytes: gzipSync(code, { level: 9 }).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { code, gzipBytes } = await buildWidget();
  mkdirSync(resolve(root, "dist"), { recursive: true });
  writeFileSync(resolve(root, "dist/widget.js"), code);
  console.log(`widget.js: ${code.length} bytes, ${gzipBytes} gzipped (limit ${MAX_GZIP_BYTES})`);
  if (gzipBytes > MAX_GZIP_BYTES) {
    console.error(`widget.js is over the ${MAX_GZIP_BYTES}-byte gzip budget`);
    process.exit(1);
  }
}
