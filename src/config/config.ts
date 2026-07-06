import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// New Gemini Configuration
export const geminiConfig = {
  pdfModelName: process.env.GEMINI_PDF_MODEL_NAME || "gemini-2.5-flash", // Default model
  vertexAiLocation: process.env.VERTEX_AI_LOCATION || "us-central1", // Default location
  gcpProjectId: process.env.GCP_PROJECT_ID || "", // Reuse GCP_PROJECT_ID
};

// Export a general GCP config for convenience
export const gcpConfig = {
  projectId: process.env.GCP_PROJECT_ID || "",
};

// Email Configuration
// Two transports are supported: SMTP (e.g. Mailgun) and Resend. EMAIL_TRANSPORT
// picks the primary; when set to "smtp", Resend acts as automatic fallback if
// RESEND_API_KEY is configured.
//
// Single recipient for all outbound mail: EMAIL_RECIPIENT. Falls back to the
// legacy SALES_LEAD_RECIPIENT_EMAIL during env migration.
const resolvedRecipient =
  process.env.EMAIL_RECIPIENT ||
  process.env.SALES_LEAD_RECIPIENT_EMAIL ||
  "wayne@tangent.sg";

export const emailConfig = {
  // Resend (fallback when transport=smtp; primary when transport=resend)
  resendApiKey: process.env.RESEND_API_KEY || "",
  recipientEmail: resolvedRecipient,
  // Legacy alias — kept so callers depending on the old name still compile.
  salesLeadRecipientEmail: resolvedRecipient,
  salesLeadFromEmail:
    process.env.SALES_LEAD_FROM_EMAIL || "onboarding@resend.dev",
  salesLeadFromName: process.env.SALES_LEAD_FROM_NAME || "GBG Portal",

  // Transport selection + SMTP
  transport: (process.env.EMAIL_TRANSPORT || "resend") as "smtp" | "resend",
  from: process.env.EMAIL_FROM || "",
  smtp: {
    host: process.env.EMAIL_SMTP_HOST || "",
    port: parseInt(process.env.EMAIL_SMTP_PORT || "587", 10),
    user: process.env.EMAIL_SMTP_USER || "",
    password: process.env.EMAIL_SMTP_PASSWORD || "",
  },
};

export function validateConfig(): void {
  const requiredEnvVars: Record<string, string | undefined> = {
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
    VERTEX_AI_LOCATION: process.env.VERTEX_AI_LOCATION,
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error(
      "FATAL ERROR: Missing required environment variables:",
      missingVars.join(", ")
    );
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  console.log("✅ Configuration validated successfully:", {
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
    VERTEX_AI_LOCATION: process.env.VERTEX_AI_LOCATION,
  });
}

// Optionally call validateConfig on import or during app startup
validateConfig();
