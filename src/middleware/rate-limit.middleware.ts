import rateLimit from "express-rate-limit";

// Applied to POST /api/email only. Public unauthenticated endpoint that
// triggers Mailgun sends — cap casual abuse while leaving comfortable
// headroom for legitimate traffic, including offices / mobile carriers
// that NAT many users behind a single IP.
//
// Defaults (30 requests / 15 min / IP) can be tuned per deployment via
// EMAIL_RATE_LIMIT_MAX and EMAIL_RATE_LIMIT_WINDOW_MS without a code change.
// Edge protection (Cloudflare/WAF) remains the primary defense.
const limit = parseInt(process.env.EMAIL_RATE_LIMIT_MAX || "30", 10);
const windowMs = parseInt(
  process.env.EMAIL_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`,
  10
);

export const emailRateLimiter = rateLimit({
  windowMs,
  limit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
