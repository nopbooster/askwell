import { PUBLIC_KEY_REGEX } from "@askwell/shared";

/** The one-line script tag a site owner pastes before `</body>`. Throws on a malformed key. */
export function buildInstallSnippet(baseUrl: string, publicKey: string): string {
  if (!PUBLIC_KEY_REGEX.test(publicKey)) throw new Error("buildInstallSnippet: invalid public key");
  return `<script src="${baseUrl.replace(/\/+$/, "")}/widget.js" data-key="${publicKey}" async></script>`;
}
