import { describe, it, expect } from "vitest";
import { sanitize, deriveBrochureLabel } from "../src/utils/sanitize";

describe("sanitize", () => {
  it("escapes the 5 HTML chars", () => {
    expect(sanitize("<script>&\"'")).toBe("&lt;script&gt;&amp;&quot;&#039;");
  });
});

describe("deriveBrochureLabel", () => {
  it.each<[string, string]>([
    ["/brochures/anti-ddos.pdf", "Anti Ddos"],
    ["/brochures/fiber-broadband.pdf", "Fiber Broadband"],
    ["https://example.com/brochures/managed-wifi.pdf", "Managed Wifi"],
    ["/brochures/sd-wan.pdf", "Sd Wan"],
    ["/brochures/anti_ddos.pdf", "Anti Ddos"],
    ["/brochures/data.pdf", "Data"],
  ])("%s → %s", (input, expected) => {
    expect(deriveBrochureLabel(input)).toBe(expected);
  });

  it("returns empty string for empty input", () => {
    expect(deriveBrochureLabel("")).toBe("");
  });

  it("returns empty string for trailing-slash URL", () => {
    expect(deriveBrochureLabel("https://example.com/")).toBe("");
  });
});
