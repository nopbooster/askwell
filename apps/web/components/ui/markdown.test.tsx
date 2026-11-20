import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown, parseInline, parseMarkdown } from "./markdown";

const render = (text: string) => renderToStaticMarkup(<Markdown text={text} />);
/** Every tag name in the output, e.g. ["div", "p", "strong"]. */
const tags = (html: string): string[] => [...new Set([...html.matchAll(/<([a-z0-9]+)[\s>/]/g)].map((m) => m[1] ?? ""))];
const ALLOWED = ["div", "p", "ul", "ol", "li", "br", "strong", "em", "code"];

/** The kind of reply the product owner reported: a bold label, "-" bullets, then plain text. */
const OWNER_EXAMPLE = [
  "Askwell has two plans:",
  "",
  "**Free ($0):**",
  "- 1 project",
  "- 100 messages per month, per project",
  "- 3 knowledge sources per project",
  "",
  "**Pro ($19/month):**",
  "- 5 projects",
  "- 2,000 messages per month, per project",
  "- 25 knowledge sources per project",
  "",
  "You can upgrade any time from Billing.",
].join("\n");

describe("parseInline", () => {
  it("parses bold, italic and code", () => {
    expect(parseInline("a **b** *c* `d`")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "code", text: "d" },
    ]);
  });
  it("nests italic inside bold and keeps code contents literal", () => {
    expect(parseInline("**a *b***")[0]).toEqual({
      type: "strong",
      children: [{ type: "text", text: "a " }, { type: "em", children: [{ type: "text", text: "b" }] }],
    });
    expect(parseInline("`**not bold**`")).toEqual([{ type: "code", text: "**not bold**" }]);
  });
  it("keeps unmatched or spaced markers literal", () => {
    expect(parseInline("**unclosed")).toEqual([{ type: "text", text: "**unclosed" }]);
    expect(parseInline("2 * 3 * 4")).toEqual([{ type: "text", text: "2 * 3 * 4" }]);
    expect(parseInline("a ** b ** c")).toEqual([{ type: "text", text: "a ** b ** c" }]);
    expect(parseInline("`open")).toEqual([{ type: "text", text: "`open" }]);
    expect(parseInline("****")).toEqual([{ type: "text", text: "****" }]);
  });
});

describe("parseMarkdown", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(parseMarkdown("a\nb\n\nc").map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
    const first = parseMarkdown("a\nb")[0];
    expect(first?.type === "paragraph" && first.lines).toHaveLength(2);
  });
  it("parses '-', '*' and '+' bullets and numbered lists with their start", () => {
    expect(parseMarkdown("- a\n* b\n+ c")).toEqual([
      { type: "bullets", items: [[[{ type: "text", text: "a" }]], [[{ type: "text", text: "b" }]], [[{ type: "text", text: "c" }]]] },
    ]);
    const ol = parseMarkdown("3. x\n4) y")[0];
    expect(ol).toMatchObject({ type: "numbered", start: 3 });
    expect(ol?.type === "numbered" && ol.items).toHaveLength(2);
  });
  it("treats '*italic*' at the start of a line as text, not a bullet", () => {
    expect(parseMarkdown("*note* this")[0]?.type).toBe("paragraph");
  });
  it("returns no blocks for an empty or blank reply", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown(" \n\n ")).toEqual([]);
  });
});

describe("Markdown", () => {
  it("renders the owner's example as bold labels and real bullet lists", () => {
    const html = render(OWNER_EXAMPLE);
    expect(html).toContain('<strong class="font-semibold">Free ($0):</strong>');
    expect(html).toContain('<strong class="font-semibold">Pro ($19/month):</strong>');
    expect(html.match(/<ul /g)).toHaveLength(2);
    expect(html.match(/<li>/g)).toHaveLength(6);
    expect(html).toContain("<li>100 messages per month, per project</li>");
    expect(html).toContain("<p>You can upgrade any time from Billing.</p>");
    expect(html).not.toContain("**");
    expect(html).not.toMatch(/>\s*- /);
  });
  it("renders italic, code, numbered lists, line breaks and headings", () => {
    expect(render("*soft*")).toContain("<em>soft</em>");
    expect(render("Run `npm i`")).toContain(">npm i</code>");
    expect(render("1. one\n2. two")).toContain('<ol class="list-decimal space-y-1 pl-5"><li>one</li><li>two</li></ol>');
    expect(render("5. five")).toContain('start="5"');
    expect(render("a\nb")).toContain("<p>a<br/>b</p>");
    expect(render("### Plans")).toContain('<p><strong class="font-semibold">Plans</strong></p>');
  });
  it("leaves an unclosed ** (e.g. a partial reply) as literal text", () => {
    expect(render("**Free ($0):")).toContain("**Free ($0):");
    expect(render("- **Pro")).toContain("<li>**Pro</li>");
  });
  it("renders an empty reply without crashing", () => {
    expect(render("")).toMatch(/^<div[^>]*><\/div>$/);
  });

  describe("never HTML", () => {
    it.each([
      ["<script>", "<script>alert(1)</script>", "&lt;script&gt;alert(1)&lt;/script&gt;"],
      ["<img onerror>", '<img src=x onerror="alert(1)">', "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"],
      ["HTML inside bold", "**<b>x</b>**", "<strong class=\"font-semibold\">&lt;b&gt;x&lt;/b&gt;</strong>"],
      ["HTML inside a list item", "- <iframe src=//evil>", "<li>&lt;iframe src=//evil&gt;</li>"],
      ["HTML entities", "&lt;b&gt; &amp; &#60;", "&amp;lt;b&amp;gt; &amp;amp; &amp;#60;"],
    ])("shows %s as literal text", (_name, input, escaped) => {
      const html = render(input);
      expect(html).toContain(escaped);
      expect(tags(html).every((t) => ALLOWED.includes(t))).toBe(true);
    });
    it("shows markdown and javascript: links as plain text, never <a>", () => {
      for (const input of ["[click](javascript:alert(1))", "[site](https://example.com)", "<a href=\"javascript:alert(1)\">x</a>"]) {
        const html = render(input);
        expect(tags(html)).not.toContain("a");
        expect(html).not.toMatch(/<[^>]*\shref=/); // escaped literal text may say "href=", a tag never does
      }
      expect(render("[click](javascript:alert(1))")).toContain("[click](javascript:alert(1))");
    });
    it("only ever outputs the allowed elements, with no event handler attributes", () => {
      const html = render(`${OWNER_EXAMPLE}\n\n1. *a* \`b\`\n\n<svg onload=alert(1)>`);
      expect(tags(html).every((t) => ALLOWED.includes(t))).toBe(true);
      expect(html).not.toMatch(/<[^>]+\son[a-z]+=/i);
    });
    it("never uses dangerouslySetInnerHTML (renderer and both bubbles)", () => {
      for (const file of ["./markdown.tsx", "../embed/message-list.tsx", "../conversations/thread-view.tsx"]) {
        expect(readFileSync(new URL(file, import.meta.url), "utf8")).not.toContain("dangerouslySetInnerHTML");
      }
    });
  });
});
