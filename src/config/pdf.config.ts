// PDF.js configuration to prevent worker issues in Node.js environment
import type { PDFDocumentProxy } from "pdfjs-dist";

interface PDFLib {
  getDocument(params: {
    data: Uint8Array | BufferSource;
    disableFontFace?: boolean;
    verbosity?: number;
  }): {
    promise: Promise<PDFDocumentProxy>;
  };
  GlobalWorkerOptions: {
    workerSrc: string;
  };
}

let pdfjsLib: PDFLib | null = null;

async function initPdfLib(): Promise<PDFLib> {
  if (!pdfjsLib) {
    const pdfjs = await import("pdfjs-dist");
    pdfjsLib = pdfjs as unknown as PDFLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  }
  return pdfjsLib;
}

export { initPdfLib };
