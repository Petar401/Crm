import "server-only";

/** Max characters of extracted text kept per file, to protect the context window. */
const MAX_CHARS = 20_000;

function truncate(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHARS) return trimmed;
  return (
    trimmed.slice(0, MAX_CHARS) +
    "\n\n[…file truncated — only the first part is shown to Aria.]"
  );
}

function isType(mimeType: string, name: string, ...exts: string[]): boolean {
  const lower = name.toLowerCase();
  return exts.some((e) => lower.endsWith(e));
}

/**
 * Extracts readable text from an uploaded file so the (text) model can read it.
 * Images return an empty string — they are handled separately as vision parts.
 * Returns a short human-readable note for unsupported/failed files rather than
 * throwing, so a bad file never breaks the whole chat turn.
 */
export async function extractTextFromFile(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string
): Promise<string> {
  const mime = (mimeType || "").toLowerCase();

  // Images are read via the vision model, not as text.
  if (mime.startsWith("image/")) return "";

  try {
    // Plain text, CSV, markdown, JSON — decode directly.
    if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "text/csv" ||
      isType(mime, fileName, ".txt", ".csv", ".md", ".json", ".log", ".tsv")
    ) {
      return truncate(Buffer.from(bytes).toString("utf-8"));
    }

    // PDF — unpdf (serverless-friendly, no native deps).
    if (mime === "application/pdf" || isType(mime, fileName, ".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      return truncate(Array.isArray(text) ? text.join("\n") : text);
    }

    // Word .docx — mammoth raw text.
    if (
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      isType(mime, fileName, ".docx")
    ) {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({
        buffer: Buffer.from(bytes),
      });
      return truncate(value);
    }

    // Excel .xlsx — exceljs, one CSV-ish block per sheet.
    if (
      mime ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      isType(mime, fileName, ".xlsx")
    ) {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      // exceljs's bundled types predate Node 22's Buffer generic; cast to its param type.
      await workbook.xlsx.load(
        Buffer.from(bytes) as unknown as Parameters<
          typeof workbook.xlsx.load
        >[0]
      );
      const parts: string[] = [];
      workbook.eachSheet((sheet) => {
        const rows: string[] = [];
        sheet.eachRow((row) => {
          const values = (row.values as unknown[]).slice(1).map((v) => {
            if (v == null) return "";
            if (typeof v === "object" && "text" in (v as object)) {
              return String((v as { text: unknown }).text ?? "");
            }
            return String(v);
          });
          rows.push(values.join(","));
        });
        parts.push(`# Sheet: ${sheet.name}\n${rows.join("\n")}`);
      });
      return truncate(parts.join("\n\n"));
    }

    // Legacy binary Office formats are not supported by these parsers.
    if (isType(mime, fileName, ".doc", ".xls", ".ppt")) {
      return `[Could not read "${fileName}": legacy Office formats (.doc/.xls/.ppt) are not supported. Please upload a PDF or .docx/.xlsx version.]`;
    }

    return `[Could not read "${fileName}": unsupported file type (${mimeType || "unknown"}).]`;
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown error";
    return `[Could not read "${fileName}": ${reason}.]`;
  }
}
