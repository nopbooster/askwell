/**
 * Pure text → chunks. Token counts are approximated by characters (about 4 per token): a chunk is
 * about 800 tokens (3,200 characters) with about 15% overlap (480 characters).
 */
export const CHUNK_SIZE_CHARS = 3200;
export const CHUNK_OVERLAP_CHARS = 480;
/** Cap per source, so one huge file can't run up embedding cost. */
export const MAX_CHUNKS_PER_SOURCE = 400;

export type ChunkOptions = {
  size?: number;
  overlap?: number;
  maxChunks?: number;
};

export type ChunkResult = {
  chunks: string[];
  /** True when the text needed more than `maxChunks` chunks and the rest was dropped. */
  truncated: boolean;
};

/** Unix newlines, no BOM or control characters, at most one blank line in a row, trimmed. */
export function normalizeText(text: string): string {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex -- strip NUL and other control chars, keep \t and \n
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The best place to cut `text.slice(start, hardEnd)`: paragraph, then sentence, then line, then word. */
function findCut(text: string, start: number, hardEnd: number, minEnd: number): number {
  const window = text.slice(minEnd, hardEnd);
  const offset = minEnd;
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph !== -1) return offset + paragraph + 2;
  let sentence = -1;
  for (const m of window.matchAll(/[.!?]["')\]]?(?=\s)/g)) sentence = m.index + m[0].length;
  if (sentence !== -1) return offset + sentence;
  const line = window.lastIndexOf("\n");
  if (line !== -1) return offset + line + 1;
  const space = window.lastIndexOf(" ");
  if (space !== -1) return offset + space + 1;
  return hardEnd; // no break at all (e.g. one long token): cut hard
}

export function chunkText(raw: string, options: ChunkOptions = {}): ChunkResult {
  const size = options.size ?? CHUNK_SIZE_CHARS;
  const overlap = options.overlap ?? CHUNK_OVERLAP_CHARS;
  const maxChunks = options.maxChunks ?? MAX_CHUNKS_PER_SOURCE;
  if (size < 2 || overlap < 0 || overlap >= size / 2 || maxChunks < 1) {
    throw new RangeError("chunkText: need size >= 2, 0 <= overlap < size / 2 and maxChunks >= 1");
  }

  const text = normalizeText(raw);
  const chunks: string[] = [];
  let truncated = false;
  let start = 0;

  while (start < text.length) {
    const hardEnd = Math.min(start + size, text.length);
    // Cut at a natural break in the second half of the window; the last chunk takes what's left.
    const end = hardEnd === text.length ? hardEnd : findCut(text, start, hardEnd, start + Math.floor(size / 2));
    const chunk = text.slice(start, end).trim();
    if (chunk) {
      if (chunks.length >= maxChunks) {
        truncated = true;
        break;
      }
      chunks.push(chunk);
    }
    if (end >= text.length) break;
    // Step back by the overlap, then forward to a word start so a chunk doesn't begin mid-word.
    let next = Math.max(end - overlap, start + 1);
    const ws = text.slice(next, end).search(/\s/);
    if (next > start + 1 && ws !== -1) next += ws + 1;
    start = next;
  }
  return { chunks, truncated };
}
