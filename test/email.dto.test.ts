import { describe, it, expect } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SendEmailDto } from "../src/dtos/email.dto";

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(SendEmailDto, payload);
  return validate(dto);
}

const baseValid = {
  name: "Alice",
  email: "alice@example.com",
  company: "Acme",
};

describe("SendEmailDto", () => {
  describe("type validation", () => {
    it("rejects unknown types", async () => {
      const errors = await validateDto({ ...baseValid, type: "bogus" });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === "type")).toBe(true);
    });

    it("accepts all 6 valid types for base fields", async () => {
      for (const type of [
        "contact",
        "download",
        "newsletter",
        "pricing",
        "inquiry",
        "sales-lead",
      ]) {
        const payload: Record<string, unknown> = { ...baseValid, type };
        // fill per-type required fields so only type-level passes
        if (type === "contact") {
          payload.address = "1 Main St";
          payload.mobile = "+1234567890";
          payload.inquiry = "This is a long enough inquiry text.";
        }
        if (type === "download") payload.downloadUrl = "https://x.com/a.pdf";
        if (type === "sales-lead") {
          payload.address = "1 Main St";
          payload.mobile = "+1234567890";
          payload.selectedProducts = [{ productName: "X", itemType: "product" }];
        }
        const errors = await validateDto(payload);
        expect(
          errors,
          `expected ${type} to validate; got ${JSON.stringify(errors)}`
        ).toHaveLength(0);
      }
    });
  });

  describe("base fields", () => {
    it("rejects missing name", async () => {
      const errors = await validateDto({
        ...baseValid,
        name: undefined,
        type: "newsletter",
      });
      expect(errors.some((e) => e.property === "name")).toBe(true);
    });

    it("rejects invalid email", async () => {
      const errors = await validateDto({
        ...baseValid,
        email: "not-an-email",
        type: "newsletter",
      });
      expect(errors.some((e) => e.property === "email")).toBe(true);
    });

    it("rejects missing company", async () => {
      const errors = await validateDto({
        ...baseValid,
        company: undefined,
        type: "newsletter",
      });
      expect(errors.some((e) => e.property === "company")).toBe(true);
    });

    it("rejects name over 100 chars", async () => {
      const errors = await validateDto({
        ...baseValid,
        name: "x".repeat(101),
        type: "newsletter",
      });
      expect(errors.some((e) => e.property === "name")).toBe(true);
    });
  });

  describe("contact type", () => {
    it("requires address, mobile, inquiry", async () => {
      const errors = await validateDto({ ...baseValid, type: "contact" });
      const failed = errors.map((e) => e.property);
      expect(failed).toContain("address");
      expect(failed).toContain("mobile");
      expect(failed).toContain("inquiry");
    });

    it("rejects invalid phone", async () => {
      const errors = await validateDto({
        ...baseValid,
        type: "contact",
        address: "1 Main St",
        mobile: "abc",
        inquiry: "A long enough inquiry here.",
      });
      expect(errors.some((e) => e.property === "mobile")).toBe(true);
    });

    it("rejects inquiry under 10 chars", async () => {
      const errors = await validateDto({
        ...baseValid,
        type: "contact",
        address: "1 Main St",
        mobile: "+1234567890",
        inquiry: "short",
      });
      expect(errors.some((e) => e.property === "inquiry")).toBe(true);
    });
  });

  describe("download type", () => {
    it("requires downloadUrl", async () => {
      const errors = await validateDto({ ...baseValid, type: "download" });
      expect(errors.some((e) => e.property === "downloadUrl")).toBe(true);
    });

    it("accepts with downloadUrl", async () => {
      const errors = await validateDto({
        ...baseValid,
        type: "download",
        downloadUrl: "https://example.com/brochure.pdf",
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe("newsletter / pricing / inquiry types", () => {
    it.each(["newsletter", "pricing", "inquiry"])(
      "accepts %s with just base fields",
      async (type) => {
        const errors = await validateDto({ ...baseValid, type });
        expect(errors).toHaveLength(0);
      }
    );
  });

  describe("sales-lead type", () => {
    it("requires address, mobile, selectedProducts", async () => {
      const errors = await validateDto({ ...baseValid, type: "sales-lead" });
      const failed = errors.map((e) => e.property);
      expect(failed).toContain("address");
      expect(failed).toContain("mobile");
      expect(failed).toContain("selectedProducts");
    });

    it("accepts with all required fields", async () => {
      const errors = await validateDto({
        ...baseValid,
        type: "sales-lead",
        address: "1 Main St",
        mobile: "+1234567890",
        selectedProducts: [{ productName: "Fiber 100", itemType: "product" }],
      });
      expect(errors).toHaveLength(0);
    });
  });
});
