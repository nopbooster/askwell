import type { ReactNode } from "react";

/**
 * A safe markdown subset for bot replies (project.md §9 XSS).
 *
 * Supported: **bold**, *italic*, `code`, paragraphs, line breaks, "-" / "*" / "+" bullet lists,
 * "1." / "1)" numbered lists, and "#" headings (shown as a bold line).
 *
 * Safety: the parser only produces plain data, and the renderer only produces React elements from a
 * fixed set (p, ul, ol, li, br, strong, em, code) with text children. Nothing is ever passed as HTML:
 * `<script>`, `<img onerror>`, entities like `&lt;` and `[links](javascript:…)` all show as literal
 * text (React escapes it). Links are deliberately not turned into <a>.
 *
 * Robustness: any input renders. Unmatched markers (an unclosed `**`, a lone `*` or backtick, as in a
 * partial reply) stay literal text, exactly as before this renderer existed.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string };

/** A line of inline content. */
export type Line = Inline[];

export type Block =
  | { type: "paragraph"; lines: Line[] }
  | { type: "heading"; line: Line }
  | { type: "bullets"; items: Line[][] }
  | { type: "numbered"; start: number; items: Line[][] };

const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const INDENTED = /^\s{2,}\S/;

/** Text → blocks. Pure; never throws. */
export function parseMarkdown(input: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const close = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of input.replace(/\r\n?/g, "\n").split("\n")) {
    if (raw.trim() === "") {
      close();
      continue;
    }

    const heading = HEADING.exec(raw);
    const bullet = heading ? null : BULLET.exec(raw);
    const numbered = heading || bullet ? null : NUMBERED.exec(raw);
    // TS narrows `current` to null inside the closure-mutated loop; read it through a typed alias.
    const open = current as Block | null;

    if (heading) {
      close();
      blocks.push({ type: "heading", line: parseInline(heading[1] ?? "") });
    } else if (bullet) {
      const item = [parseInline(bullet[1] ?? "")];
      if (open?.type === "bullets") open.items.push(item);
      else {
        close();
        current = { type: "bullets", items: [item] };
      }
    } else if (numbered) {
      const item = [parseInline(numbered[2] ?? "")];
      if (open?.type === "numbered") open.items.push(item);
      else {
        close();
        current = { type: "numbered", start: Number(numbered[1]), items: [item] };
      }
    } else if ((open?.type === "bullets" || open?.type === "numbered") && INDENTED.test(raw)) {
      // An indented line under a list item continues that item on a new line.
      open.items[open.items.length - 1]?.push(parseInline(raw.trim()));
    } else if (open?.type === "paragraph") {
      open.lines.push(parseInline(raw.trim()));
    } else {
      close();
      current = { type: "paragraph", lines: [parseInline(raw.trim())] };
    }
  }
  close();
  return blocks;
}

/** One line → inline nodes. Unmatched markers stay literal. Pure; never throws. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    } else if (ch === "*" && text[i + 1] === "*") {
      let end = text.indexOf("**", i + 2);
      // In a run like "***", close on the last two stars, so "**a *b***" is bold "a *b*".
      while (end !== -1 && text[end + 2] === "*") end += 1;
      const inner = end === -1 ? "" : text.slice(i + 2, end);
      if (inner.trim() !== "" && inner === inner.trim()) {
        flush();
        out.push({ type: "strong", children: parseInline(inner) });
        i = end + 2;
        continue;
      }
      // Not a pair: keep both stars literal (don't reread the second one as italic).
      buffer += "**";
      i += 2;
      continue;
    } else if (ch === "*") {
      const end = findClosingStar(text, i + 1);
      const inner = end === -1 ? "" : text.slice(i + 1, end);
      if (inner.trim() !== "" && inner === inner.trim()) {
        flush();
        out.push({ type: "em", children: parseInline(inner) });
        i = end + 1;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }
  flush();
  return out;
}

/** The next single `*` (not part of `**`) at or after `from`, or -1. */
function findClosingStar(text: string, from: number): number {
  for (let j = from; j < text.length; j++) {
    if (text[j] !== "*") continue;
    if (text[j + 1] === "*") {
      j += 1; // skip a `**` pair inside italic text
      continue;
    }
    return j;
  }
  return -1;
}

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "strong":
        return <strong key={i} className="font-semibold">{renderInline(node.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(node.children)}</em>;
      case "code":
        return (
          <code key={i} className="rounded bg-surface-strong px-1 font-mono text-[0.9em]">
            {node.text}
          </code>
        );
    }
  });
}

function renderLines(lines: Line[]): ReactNode[] {
  return lines.flatMap((line, i) => (i === 0 ? renderInline(line) : [<br key={`br${i}`} />, ...renderInline(line)]));
}

/**
 * Renders a reply through the safe subset. Block elements, so put it in a <div>, not a <p>.
 * Long words and URLs wrap anywhere, so a bubble never forces sideways scrolling.
 */
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className={`min-w-0 space-y-2 [overflow-wrap:anywhere] ${className}`}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return <p key={i}>{renderLines(block.lines)}</p>;
          case "heading":
            return (
              <p key={i}>
                <strong className="font-semibold">{renderInline(block.line)}</strong>
              </p>
            );
          case "bullets":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={j}>{renderLines(item)}</li>
                ))}
              </ul>
            );
          case "numbered":
            return (
              <ol key={i} start={block.start === 1 ? undefined : block.start} className="list-decimal space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={j}>{renderLines(item)}</li>
                ))}
              </ol>
            );
        }
      })}
    </div>
  );
}
