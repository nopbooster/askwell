import "server-only";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import type { KnowledgeSourceType } from "@askwell/shared";
import { ExtractionError, NoTextError } from "./errors";
import { normalizeText } from "./chunk";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** True when the bytes start with the PDF header. The browser-declared type is never trusted. */
export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((b, i) => bytes[i] === b);
}

/**
 * Text of a PDF, Markdown or TXT file (MD/TXT as UTF-8). Returns normalized text.
 * Throws `NoTextError` when there is none (a scanned PDF, an empty file) and `ExtractionError`
 * when the bytes can't be read as the declared type. Extracted text is data, never instructions.
 */
export async function extractText(type: Exclude<KnowledgeSourceType, "text">, bytes: Uint8Array): Promise<string> {
  let raw: string;
  if (type === "pdf") {
    if (!isPdf(bytes)) throw new ExtractionError("Not a PDF file.");
    try {
      // unpdf transfers the buffer to its worker, so hand it a copy.
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractPdfText(pdf, { mergePages: true });
      raw = text;
    } catch (error) {
      throw new ExtractionError("Could not read the PDF.", { cause: error });
    }
  } else {
    try {
      raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw new ExtractionError("The file is not valid UTF-8 text.", { cause: error });
    }
  }
  const text = normalizeText(raw);
  if (!text) throw new NoTextError();
  return text;
}
