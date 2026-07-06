export function sanitize(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Derive a human-readable label from a brochure download URL. Turns a path
// like "/brochures/anti-ddos.pdf" into "Anti Ddos" so the email recipient
// sees which brochure the user requested without having to parse the URL.
export function deriveBrochureLabel(url: string): string {
  if (!url) return "";
  try {
    // new URL() wants an absolute URL; fall back to treating input as a path.
    const pathname = url.startsWith("http") ? new URL(url).pathname : url;
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    const withoutExt = last.replace(/\.[a-z0-9]+$/i, "");
    const words = withoutExt.replace(/[-_]+/g, " ").trim();
    if (!words) return "";
    return words
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}
