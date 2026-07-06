import { vi, describe, it, expect, beforeEach } from "vitest";
import type { CartItemDto } from "../src/dtos/cart.dto";
import type { SalesLeadEmailData } from "../src/services/email.service";

const { mockResendSend, mockSendMail, mockCreateTransport, configRef } =
  vi.hoisted(() => ({
    mockResendSend: vi.fn(),
    mockSendMail: vi.fn(),
    mockCreateTransport: vi.fn(),
    configRef: {
      emailConfig: {
        resendApiKey: "",
        recipientEmail: "sales@example.com",
        salesLeadRecipientEmail: "sales@example.com",
        salesLeadFromEmail: "from@resend.dev",
        salesLeadFromName: "GBG Portal",
        transport: "resend" as "smtp" | "resend",
        from: "",
        smtp: { host: "", port: 587, user: "", password: "" },
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

const sampleData: SalesLeadEmailData = {
  customerName: "Alice",
  customerEmail: "alice@example.com",
  companyName: "Acme",
  officeAddress: "1 Main St",
  customerPhone: "+1234",
  selectedProducts: [
    { productName: "Fiber 100", itemType: "product" } as CartItemDto,
  ],
};

async function loadService() {
  const mod = await import("../src/services/email.service");
  return new mod.EmailService();
}

function resetConfig(overrides: Partial<typeof configRef.emailConfig>) {
  configRef.emailConfig = {
    resendApiKey: "",
    recipientEmail: "sales@example.com",
    salesLeadRecipientEmail: "sales@example.com",
    salesLeadFromEmail: "from@resend.dev",
    salesLeadFromName: "GBG Portal",
    transport: "resend",
    from: "",
    smtp: { host: "", port: 587, user: "", password: "" },
    ...overrides,
  };
}

describe("EmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
    mockSendMail.mockResolvedValue({ messageId: "smtp-id" });
    mockResendSend.mockResolvedValue({ data: { id: "resend-id" }, error: null });
  });

  describe("transport=resend (default / existing behavior)", () => {
    it("sends via Resend when API key configured", async () => {
      resetConfig({ transport: "resend", resendApiKey: "re_abc" });
      const svc = await loadService();

      const ok = await svc.sendSalesLeadEmail(sampleData);

      expect(ok).toBe(true);
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockResendSend.mock.calls[0][0]).toMatchObject({
        from: "GBG Portal <from@resend.dev>",
        to: "sales@example.com",
        subject: "GBG Portal Inquiry",
      });
    });

    it("returns false silently when Resend API key missing", async () => {
      resetConfig({ transport: "resend", resendApiKey: "" });
      const svc = await loadService();

      const ok = await svc.sendSalesLeadEmail(sampleData);

      expect(ok).toBe(false);
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("returns false when Resend returns error", async () => {
      resetConfig({ transport: "resend", resendApiKey: "re_abc" });
      mockResendSend.mockResolvedValueOnce({
        data: null,
        error: { message: "rejected" },
      });
      const svc = await loadService();

      const ok = await svc.sendSalesLeadEmail(sampleData);

      expect(ok).toBe(false);
    });
  });

  describe("transport=smtp", () => {
    const smtpCfg = {
      transport: "smtp" as const,
      from: "noreply@convergeict.com",
      smtp: {
        host: "smtp.eu.mailgun.org",
        port: 587,
        user: "noreply@convergeict.com",
        password: "secret",
      },
    };

    it("sends via SMTP when configured, does not touch Resend", async () => {
      resetConfig({ ...smtpCfg, resendApiKey: "re_abc" });
      const svc = await loadService();

      const ok = await svc.sendSalesLeadEmail(sampleData);

      expect(ok).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(mockSendMail.mock.calls[0][0]).toMatchObject({
        from: "noreply@convergeict.com",
        to: "sales@example.com",
        subject: "GBG Portal Inquiry",
      });
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "smtp.eu.mailgun.org",
          port: 587,
          secure: false,
          auth: { user: "noreply@convergeict.com", pass: "secret" },
        })
      );
    });

    it("falls back to Resend when SMTP throws (any error)", async () => {
      resetConfig({ ...smtpCfg, resendApiKey: "re_abc" });
      mockSendMail.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const svc = await loadService();

      const ok = await svc.sendSalesLeadEmail(sampleData);

      expect(ok).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      // Fallback uses Resend's own from-address, not the SMTP one
      expect(mockResendSend.mock.calls[0][0]).toMatchObject({
        from: "GBG Portal <from@resend.dev>",
      });
    });

    it("falls back to Resend on SMTP auth failure", async () => {
      resetConfig({ ...smtpCfg, resendApiKey: "re_abc" });
      mockSendMail.mockRejectedValueOnce(
        Object.assign(new Error("Invalid login"), { code: "EAUTH" })
      );
      const svc = await loadService();

      const ok = await svc.sendSalesLeadEmail(sampleData);

      expect(ok).toBe(true);
      expect(mockResendSend).toHaveBeenCalledTimes(1);
    });

    it("returns false when SMTP fails and Resend not configured", async () => {
      resetConfig({ ...smtpCfg, resendApiKey: "" });
      mockSendMail.mockRejectedValueOnce(new Error("boom"));
      const svc = await loadService();

      const ok = await svc.sendSalesLeadEmail(sampleData);

      expect(ok).toBe(false);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("returns false when both SMTP and Resend fail", async () => {
      resetConfig({ ...smtpCfg, resendApiKey: "re_abc" });
      mockSendMail.mockRejectedValueOnce(new Error("smtp down"));
      mockResendSend.mockResolvedValueOnce({
        data: null,
        error: { message: "resend down" },
      });
      const svc = await loadService();

      const ok = await svc.sendSalesLeadEmail(sampleData);

      expect(ok).toBe(false);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockResendSend).toHaveBeenCalledTimes(1);
    });

    it("promotes Resend to primary when transport=smtp but SMTP host missing", async () => {
      resetConfig({
        transport: "smtp",
        from: "noreply@convergeict.com",
        smtp: { host: "", port: 587, user: "", password: "" },
        resendApiKey: "re_abc",
      });
      const svc = await loadService();

      const ok = await svc.sendSalesLeadEmail(sampleData);

      expect(ok).toBe(true);
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockResendSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("never throws (non-blocking contract)", () => {
    it("returns false instead of throwing when everything errors", async () => {
      resetConfig({
        transport: "smtp",
        from: "x@y.com",
        smtp: {
          host: "smtp.example",
          port: 587,
          user: "u",
          password: "p",
        },
        resendApiKey: "re_abc",
      });
      mockSendMail.mockRejectedValueOnce(new Error("1"));
      mockResendSend.mockRejectedValueOnce(new Error("2"));
      const svc = await loadService();

      await expect(svc.sendSalesLeadEmail(sampleData)).resolves.toBe(false);
    });
  });
});
