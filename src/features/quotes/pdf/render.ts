import "server-only";

/**
 * Boots a headless Chromium (bundled by @sparticuz/chromium in serverless,
 * or a local install in dev) and renders the given HTML to a PDF buffer.
 * The dynamic imports keep puppeteer out of the client bundle and out of
 * cold-start when no PDF is requested.
 */
export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const puppeteer = (await import("puppeteer-core")).default;
  const chromium = (await import("@sparticuz/chromium")).default;

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    (await chromium.executablePath());

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: chromium.headless,
    defaultViewport: chromium.defaultViewport,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "10mm", right: "10mm", bottom: "16mm", left: "10mm" },
      printBackground: true,
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
