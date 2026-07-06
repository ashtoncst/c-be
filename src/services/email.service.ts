// src/services/email.service.ts

/**
 * EmailService — single engine for all outbound mail from the site.
 *
 * Transport: chosen by EMAIL_TRANSPORT (smtp | resend). When transport=smtp,
 * Resend is used as an automatic fallback on any SMTP error if
 * RESEND_API_KEY is configured.
 *
 * Contract: send() / sendSalesLeadEmail() are non-blocking — they return a
 * boolean and never throw. Callers (e.g. cart.service, email.controller) must
 * not have their flow blocked by email delivery failures.
 */

import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { emailConfig } from "../config/config.js";
import { Logger } from "../utils/logger.js";
import { CartItemDto } from "../dtos/cart.dto.js";
import { sanitize, deriveBrochureLabel } from "../utils/sanitize.js";
import type { EmailType } from "../dtos/email.dto.js";

const logger = new Logger({ serviceName: "EmailService" });

// -- Data shapes -------------------------------------------------------------

export interface SalesLeadEmailData {
  customerName: string;
  customerEmail: string;
  companyName: string;
  officeAddress: string;
  customerPhone: string;
  selectedProducts: CartItemDto[];
}

export interface MarketingEmailData {
  name: string;
  email: string;
  company: string;
  address?: string;
  mobile?: string;
  inquiry?: string;
  downloadUrl?: string;
  downloadName?: string;
}

// send() takes either shape; the controller passes whatever the DTO produced.
export type SendPayload = MarketingEmailData | SalesLeadEmailData | Record<string, unknown>;

// -- Transport layer ---------------------------------------------------------

interface OutboundMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface MailTransport {
  readonly name: "smtp" | "resend";
  resolveFrom(): string;
  send(msg: OutboundMessage): Promise<void>;
}

class SmtpTransport implements MailTransport {
  readonly name = "smtp" as const;
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: false, // port 587 uses STARTTLS
      auth: {
        user: emailConfig.smtp.user,
        pass: emailConfig.smtp.password,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  resolveFrom(): string {
    return emailConfig.from;
  }

  async send(msg: OutboundMessage): Promise<void> {
    await this.transporter.sendMail(msg);
  }
}

class ResendTransport implements MailTransport {
  readonly name = "resend" as const;
  private client: Resend;

  constructor() {
    this.client = new Resend(emailConfig.resendApiKey);
  }

  resolveFrom(): string {
    return `${emailConfig.salesLeadFromName} <${emailConfig.salesLeadFromEmail}>`;
  }

  async send(msg: OutboundMessage): Promise<void> {
    const { error } = await this.client.emails.send(msg);
    if (error) {
      throw new Error(error.message);
    }
  }
}

// -- Service -----------------------------------------------------------------

export class EmailService {
  private primary: MailTransport | null;
  private fallback: MailTransport | null;

  constructor() {
    const smtp = emailConfig.smtp.host ? new SmtpTransport() : null;
    const resend = emailConfig.resendApiKey ? new ResendTransport() : null;

    if (emailConfig.transport === "smtp") {
      if (smtp) {
        this.primary = smtp;
        this.fallback = resend;
      } else {
        logger.warn(
          "EMAIL_TRANSPORT=smtp but EMAIL_SMTP_HOST not set; using Resend"
        );
        this.primary = resend;
        this.fallback = null;
      }
    } else {
      this.primary = resend;
      this.fallback = null;
    }
  }

  async send(type: EmailType | string, data: SendPayload): Promise<boolean> {
    let subject: string;
    let html: string;
    let text: string;

    try {
      const rendered = this.renderForType(type as EmailType, data);
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    } catch (error) {
      logger.error(
        "Unable to render email for type",
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }

    const baseMsg = {
      to: emailConfig.recipientEmail,
      subject,
      html,
      text,
    };

    return this.dispatch(baseMsg, { type });
  }

  async sendSalesLeadEmail(data: SalesLeadEmailData): Promise<boolean> {
    return this.send("sales-lead", data);
  }

  private async dispatch(
    baseMsg: Omit<OutboundMessage, "from">,
    context: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.primary) {
      logger.warn("No email transport configured; skipping send", {
        to: baseMsg.to,
      });
      return false;
    }

    const sent = await this.trySend(this.primary, baseMsg, context);
    if (sent) return true;

    if (this.fallback) {
      logger.warn("Primary transport failed, attempting fallback", {
        primary: this.primary.name,
        fallback: this.fallback.name,
      });
      const fellBack = await this.trySend(this.fallback, baseMsg, context);
      if (fellBack) return true;
    }

    logger.warn("Email send failed - continuing without blocking", {
      to: baseMsg.to,
      ...context,
    });
    return false;
  }

  private async trySend(
    transport: MailTransport,
    baseMsg: Omit<OutboundMessage, "from">,
    context: Record<string, unknown>
  ): Promise<boolean> {
    try {
      logger.info("Sending email", {
        transport: transport.name,
        to: baseMsg.to,
        subject: baseMsg.subject,
        ...context,
      });

      await transport.send({ ...baseMsg, from: transport.resolveFrom() });

      logger.info("Email sent successfully", {
        transport: transport.name,
        to: baseMsg.to,
        ...context,
      });
      return true;
    } catch (error) {
      logger.error(
        `Failed to send email via ${transport.name}`,
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  // ---- Render dispatch ----

  private renderForType(
    type: EmailType,
    data: SendPayload
  ): { subject: string; html: string; text: string } {
    switch (type) {
      case "contact":
        return this.renderContact(data as MarketingEmailData);
      case "download":
        return this.renderDownload(data as MarketingEmailData);
      case "newsletter":
        return this.renderNewsletter(data as MarketingEmailData);
      case "pricing":
        return this.renderPricing(data as MarketingEmailData);
      case "inquiry":
        return this.renderInquiry(data as MarketingEmailData);
      case "sales-lead":
        return this.renderSalesLead(data as SalesLeadEmailData);
      default:
        throw new Error(`Unknown email type: ${type}`);
    }
  }

  // ---- Marketing templates (ported verbatim from FE route) ----

  private renderContact(data: MarketingEmailData): {
    subject: string;
    html: string;
    text: string;
  } {
    const s = this.sanitizeMarketing(data);
    const subject = `New Inquiry from ${s.name} — ${s.company}`;
    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background-color: #024645; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; font-size: 22px; margin: 0;">New Contact Form Inquiry</h1>
      </div>
      <div style="padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; width: 140px; vertical-align: top;">Name</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">${s.name}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; vertical-align: top;">Email</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${s.email}" style="color: #038F8D;">${s.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; vertical-align: top;">Company</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">${s.company}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; vertical-align: top;">Office Address</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">${s.address ?? ""}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; vertical-align: top;">Mobile</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;"><a href="tel:${s.mobile ?? ""}" style="color: #038F8D;">${s.mobile ?? ""}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 600; vertical-align: top;">Inquiry</td>
            <td style="padding: 12px 0; white-space: pre-wrap;">${s.inquiry ?? ""}</td>
          </tr>
        </table>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 16px; text-align: center;">
        Sent from the Converge Global website contact form
      </p>
    </div>`;
    const text = `New Contact Form Inquiry\n\nName: ${s.name}\nEmail: ${s.email}\nCompany: ${s.company}\nAddress: ${s.address ?? ""}\nMobile: ${s.mobile ?? ""}\nInquiry:\n${s.inquiry ?? ""}\n`;
    return { subject, html, text };
  }

  private renderDownload(data: MarketingEmailData): {
    subject: string;
    html: string;
    text: string;
  } {
    const s = this.sanitizeMarketing(data);
    // Prefer the FE-supplied label (authoritative brand naming) over
    // backend derivation. Fall back to deriveBrochureLabel() for brochures
    // the FE label map hasn't caught up to. The URL itself is not shown
    // in the email — sales only needs the brochure name.
    const rawUrl = data.downloadUrl ?? "";
    const label =
      (data.downloadName && data.downloadName.trim()) ||
      (rawUrl ? deriveBrochureLabel(rawUrl) : "");
    const safeLabel = label ? sanitize(label) : "";
    const brochureCell = safeLabel || "N/A";

    const subject = label
      ? `Brochure Download — ${label} — ${s.name} (${s.company})`
      : `Brochure Download — ${s.name} (${s.company})`;
    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background-color: #024645; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; font-size: 22px; margin: 0;">New Brochure Download</h1>
      </div>
      <div style="padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; width: 140px; vertical-align: top;">Name</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">${s.name}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; vertical-align: top;">Email</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${s.email}" style="color: #038F8D;">${s.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; vertical-align: top;">Company</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">${s.company}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 600; vertical-align: top;">Brochure</td>
            <td style="padding: 12px 0;">${brochureCell}</td>
          </tr>
        </table>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 16px; text-align: center;">
        Sent from the Converge Global website brochure download
      </p>
    </div>`;
    const text = `New Brochure Download\n\nName: ${s.name}\nEmail: ${s.email}\nCompany: ${s.company}\nBrochure: ${label || "N/A"}\n`;
    return { subject, html, text };
  }

  private renderNewsletter(data: MarketingEmailData): {
    subject: string;
    html: string;
    text: string;
  } {
    const s = this.sanitizeMarketing(data);
    const subject = `Newsletter Signup — ${s.name} (${s.company})`;
    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background-color: #024645; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; font-size: 22px; margin: 0;">New Newsletter Signup</h1>
      </div>
      <div style="padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; width: 140px; vertical-align: top;">Name</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">${s.name}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; vertical-align: top;">Email</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${s.email}" style="color: #038F8D;">${s.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 600; vertical-align: top;">Company</td>
            <td style="padding: 12px 0;">${s.company}</td>
          </tr>
        </table>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 16px; text-align: center;">
        Sent from the Converge Global website — Coming Soon page
      </p>
    </div>`;
    const text = `New Newsletter Signup\n\nName: ${s.name}\nEmail: ${s.email}\nCompany: ${s.company}\n`;
    return { subject, html, text };
  }

  private renderPricing(data: MarketingEmailData): {
    subject: string;
    html: string;
    text: string;
  } {
    const s = this.sanitizeMarketing(data);
    const subject = `Pricing Request — ${s.name} (${s.company})`;
    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background-color: #024645; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; font-size: 22px; margin: 0;">New Pricing Request</h1>
      </div>
      <div style="padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; width: 140px; vertical-align: top;">Name</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">${s.name}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; vertical-align: top;">Email</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${s.email}" style="color: #038F8D;">${s.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 600; vertical-align: top;">Company</td>
            <td style="padding: 12px 0;">${s.company}</td>
          </tr>
        </table>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 16px; text-align: center;">
        Sent from the Converge Global website pricing request
      </p>
    </div>`;
    const text = `New Pricing Request\n\nName: ${s.name}\nEmail: ${s.email}\nCompany: ${s.company}\n`;
    return { subject, html, text };
  }

  private renderInquiry(data: MarketingEmailData): {
    subject: string;
    html: string;
    text: string;
  } {
    const s = this.sanitizeMarketing(data);
    const subject = `Inquiry — ${s.name} (${s.company})`;
    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background-color: #024645; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; font-size: 22px; margin: 0;">New Inquiry</h1>
      </div>
      <div style="padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; width: 140px; vertical-align: top;">Name</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">${s.name}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: 600; vertical-align: top;">Email</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${s.email}" style="color: #038F8D;">${s.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 600; vertical-align: top;">Company</td>
            <td style="padding: 12px 0;">${s.company}</td>
          </tr>
        </table>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 16px; text-align: center;">
        Sent from the Converge Global website inquiry modal
      </p>
    </div>`;
    const text = `New Inquiry\n\nName: ${s.name}\nEmail: ${s.email}\nCompany: ${s.company}\n`;
    return { subject, html, text };
  }

  private renderSalesLead(data: SalesLeadEmailData): {
    subject: string;
    html: string;
    text: string;
  } {
    const s = {
      customerName: sanitize(data.customerName ?? ""),
      customerEmail: sanitize(data.customerEmail ?? ""),
      companyName: sanitize(data.companyName ?? ""),
      officeAddress: sanitize(data.officeAddress ?? ""),
      customerPhone: sanitize(data.customerPhone ?? ""),
    };

    const productListHtml = (data.selectedProducts ?? [])
      .map((product) => {
        const name = sanitize(String(product.itemName ?? product.productName ?? ""));
        const type = sanitize(String(product.itemType ?? "product"));
        return `<li><strong>${name}</strong> <em>(${type})</em></li>`;
      })
      .join("");

    const productListText = (data.selectedProducts ?? [])
      .map((product, index) => {
        const name = product.itemName ?? product.productName;
        const type = product.itemType ?? "product";
        return `${index + 1}. ${name} (${type})`;
      })
      .join("\n");

    const subject = "GBG Portal Inquiry";
    const text = `[TEST EMAIL - NO NEED TO REPLY]

Customer Details:
- Name: ${data.customerName}
- Email: ${data.customerEmail}
- Company: ${data.companyName}
- Address: ${data.officeAddress}
- Mobile: ${data.customerPhone}

Products Selected:
${productListText}

---
This inquiry was submitted via the GBG Portal.`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f8d7da; padding: 10px 15px; border-radius: 4px; margin-bottom: 20px; }
    .header-text { color: #721c24; font-weight: bold; margin: 0; }
    .section { margin-bottom: 20px; }
    .section-title { color: #2c5282; font-size: 18px; margin-bottom: 10px; border-bottom: 2px solid #2c5282; padding-bottom: 5px; }
    .detail-row { margin: 8px 0; }
    .label { font-weight: bold; color: #4a5568; }
    ol { padding-left: 20px; }
    li { margin: 8px 0; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p class="header-text">⚠️ TEST EMAIL - NO NEED TO REPLY</p>
    </div>

    <div class="section">
      <h2 class="section-title">Customer Details</h2>
      <div class="detail-row"><span class="label">Name:</span> ${s.customerName}</div>
      <div class="detail-row"><span class="label">Email:</span> ${s.customerEmail}</div>
      <div class="detail-row"><span class="label">Company:</span> ${s.companyName}</div>
      <div class="detail-row"><span class="label">Address:</span> ${s.officeAddress}</div>
      <div class="detail-row"><span class="label">Mobile:</span> ${s.customerPhone}</div>
    </div>

    <div class="section">
      <h2 class="section-title">Products Selected</h2>
      <ol>
        ${productListHtml}
      </ol>
    </div>

    <div class="footer">
      This inquiry was submitted via the GBG Portal.
    </div>
  </div>
</body>
</html>`;
    return { subject, html, text };
  }

  private sanitizeMarketing(data: MarketingEmailData): Required<
    Pick<MarketingEmailData, "name" | "email" | "company">
  > &
    MarketingEmailData {
    return {
      name: sanitize(data.name ?? ""),
      email: sanitize(data.email ?? ""),
      company: sanitize(data.company ?? ""),
      address: data.address ? sanitize(data.address) : undefined,
      mobile: data.mobile ? sanitize(data.mobile) : undefined,
      inquiry: data.inquiry ? sanitize(data.inquiry) : undefined,
      downloadUrl: data.downloadUrl ? sanitize(data.downloadUrl) : undefined,
    };
  }
}

export const emailService = new EmailService();
