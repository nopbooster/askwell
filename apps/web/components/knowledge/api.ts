import { ListKnowledgeResponseSchema, type KnowledgeSource } from "@askwell/shared";

/** GET /api/projects/:id/knowledge. `null` on any failure (the caller keeps what it has). */
export async function fetchSources(projectId: string): Promise<KnowledgeSource[] | null> {
  try {
    const response = await fetch(`/api/projects/${projectId}/knowledge`, { cache: "no-store" });
    if (!response.ok) return null;
    const parsed = ListKnowledgeResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.sources : null;
  } catch {
    return null;
  }
}

/**
 * Sends the file straight to Storage's one-time signed URL (multipart PUT, the same format
 * supabase-js `uploadToSignedUrl` uses). The file never goes through our routes. XHR, for progress.
 * The MIME type is set from the checked extension, because the bucket only accepts PDF/MD/TXT types
 * and browsers often send an empty type for .md.
 */
export function uploadToSignedUrl(
  signedUrl: string,
  file: File,
  mimeType: string,
  onProgress: (fraction: number) => void,
): Promise<{ ok: true } | { ok: false }> {
  return new Promise((resolve) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", new File([file], file.name, { type: mimeType }));
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? { ok: true } : { ok: false });
    xhr.onerror = () => resolve({ ok: false });
    xhr.onabort = () => resolve({ ok: false });
    xhr.send(form);
  });
}
