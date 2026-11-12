// Builds the widget loader and copies it to public/widget.js, so the app serves it at /widget.js.
// Runs from `predev` and `prebuild`. Fails the build if the bundle is over its size budget.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_GZIP_BYTES, buildWidget } from "../../widget/build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../public/widget.js");

const { code, gzipBytes } = await buildWidget();
if (gzipBytes > MAX_GZIP_BYTES) {
  console.error(`widget.js is ${gzipBytes} bytes gzipped, over the ${MAX_GZIP_BYTES}-byte budget`);
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
// Generated file: keep ESLint (which lints public/) away from the minified bundle.
writeFileSync(out, `/* eslint-disable */\n${code}`);
console.log(`copy-widget: public/widget.js (${code.length} bytes, ${gzipBytes} gzipped)`);
