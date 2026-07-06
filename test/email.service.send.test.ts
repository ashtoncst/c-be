import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockResendSend, mockSendMail, mockCreateTransport, configRef } =
  vi.hoisted(() => ({
    mockResendSend: vi.fn(),
    mockSendMail: vi.fn(),
    mockCreateTransport: vi.fn(),
    configRef: {
      emailConfig: {
        resendApiKey: "re_abc",
        salesLeadRecipientEmail: "inbox@example.com",
        recipientEmail: "inbox@example.com",
        salesLeadFromEmail: "from@resend.dev",
        salesLeadFromName: "GBG Portal",
        transport: "smtp" as "smtp" | "resend",
        from: "noreply@convergeict.com",
        smtp: {
          host: "smtp.test",
          port: 587,
          user: "user",
          password: "pass",
        },
      },
    },
  }));

vi.mock("../src/config/config.js", () => ({
  get emailConfig() {
    return configRef.emailConfig;
  },
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

async function loadService() {
  const mod = await import("../src/services/email.service");
  return new mod.EmailService();
}

const baseMarketing = {
  name: "Alice Test",
  email: "alice@example.com",
  company: "Acme",
};

describe("EmailService.send()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
    mockSendMail.mockResolvedValue({ messageId: "smtp-id" });
    mockResendSend.mockResolvedValue({ data: { id: "r" }, error: null });
  });

  describe("type dispatch → subject", () => {
    const cases: [string, Record<string, unknown>, string][] = [
      [
        "contact",
        {
          address: "1 Main",
          mobile: "+1234567890",
          inquiry: "A real inquiry here.",
        },
        "New Inquiry from Alice Test — Acme",
      ],
      [
        "download",
        { downloadUrl: "https://x.com/anti-ddos.pdf" },
        "Brochure Download — Anti Ddos — Alice Test (Acme)",
      ],
      ["newsletter", {}, "Newsletter Signup — Alice Test (Acme)"],
      ["pricing", {}, "Pricing Request — Alice Test (Acme)"],
      ["inquiry", {}, "Inquiry — Alice Test (Acme)"],
    ];

    it.each(cases)("type=%s → subject=%s", async (type, extra, subject) => {
      const svc = await loadService();
      const ok = await svc.send(type, { ...baseMarketing, ...extra });
      expect(ok).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail.mock.calls[0][0]).toMatchObject({
        subject,
        to: "inbox@example.com",
        from: "noreply@convergeict.com",
      });
      expect(mockSendMail.mock.calls[0][0].html).toContain(baseMarketing.name);
    });
  });

  describe("sales-lead type", () => {
    it("renders sales-lead subject + template with product list", async () => {
      const svc = await loadService();
      const ok = await svc.send("sales-lead", {
        customerName: "Bob",
        customerEmail: "bob@example.com",
        companyName: "CorpCo",
        officeAddress: "2 Side Rd",
        customerPhone: "+9999",
        selectedProducts: [{ itemName: "Fiber 100", itemType: "product" }],
      });
      expect(ok).toBe(true);
      const msg = mockSendMail.mock.calls[0][0];
      expect(msg.subject).toBe("GBG Portal Inquiry");
      expect(msg.html).toContain("Fiber 100");
      expect(msg.html).toContain("Bob");
    });
  });

  describe("download brochure label", () => {
    it("prefers FE-supplied downloadName over derived label", async () => {
      const svc = await loadService();
      await svc.send("download", {
        ...baseMarketing,
        downloadUrl: "/brochures/cable-system.pdf",
        downloadName: "SEA-H2X",
      });
      const msg = mockSendMail.mock.calls[0][0];
      expect(msg.html).toContain("SEA-H2X");
      // URL should not appear in the email body — only the brand name.
      expect(msg.html).not.toContain("/brochures/cable-system.pdf");
      expect(msg.text).not.toContain("/brochures/cable-system.pdf");
      expect(msg.subject).toBe(
        "Brochure Download — SEA-H2X — Alice Test (Acme)"
      );
      expect(msg.text).toContain("Brochure: SEA-H2X");
    });

    it("uses derived label when FE omits downloadName", async () => {
      const svc = await loadService();
      await svc.send("download", {
        ...baseMarketing,
        downloadUrl: "/brochures/anti-ddos.pdf",
      });
      const msg = mockSendMail.mock.calls[0][0];
      expect(msg.html).toContain("Anti Ddos");
      expect(msg.html).not.toContain("/brochures/anti-ddos.pdf");
      expect(msg.subject).toBe(
        "Brochure Download — Anti Ddos — Alice Test (Acme)"
      );
      expect(msg.text).toContain("Brochure: Anti Ddos");
    });

    it("falls back gracefully when URL has no derivable name", async () => {
      const svc = await loadService();
      await svc.send("download", {
        ...baseMarketing,
        downloadUrl: "https://example.com/",
      });
      const msg = mockSendMail.mock.calls[0][0];
      // Should not crash; subject falls back to the short form.
      expect(msg.subject).toBe("Brochure Download — Alice Test (Acme)");
      expect(msg.html).toContain("N/A");
    });
  });

  describe("sanitization", () => {
    it("escapes HTML in user fields before interpolating", async () => {
      const svc = await loadService();
      await svc.send("newsletter", {
        ...baseMarketing,
        name: "<script>alert(1)</script>",
      });
      const msg = mockSendMail.mock.calls[0][0];
      expect(msg.html).not.toContain("<script>alert(1)</script>");
      expect(msg.html).toContain("&lt;script&gt;");
    });
  });

  describe("fallback path (inherited from phase 1)", () => {
    it("falls back to Resend on SMTP failure regardless of type", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const svc = await loadService();
      const ok = await svc.send("contact", {
        ...baseMarketing,
        address: "1 Main",
        mobile: "+1234567890",
        inquiry: "Hello there.",
      });
      expect(ok).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockResendSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendSalesLeadEmail (delegate)", () => {
    it("still works and routes through send()", async () => {
      const svc = await loadService();
      const ok = await svc.sendSalesLeadEmail({
        customerName: "Carol",
        customerEmail: "c@example.com",
        companyName: "X",
        officeAddress: "3",
        customerPhone: "+1",
        selectedProducts: [{ productName: "p", itemType: "t" } as never],
      });
      expect(ok).toBe(true);
      expect(mockSendMail.mock.calls[0][0].subject).toBe("GBG Portal Inquiry");
    });
  });

  describe("unknown type", () => {
    it("returns false and logs error", async () => {
      const svc = await loadService();
      // @ts-expect-error — testing runtime guard
      const ok = await svc.send("bogus", baseMarketing);
      expect(ok).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });
});
