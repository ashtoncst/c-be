// src/middleware/session-auth.middleware.ts

import { NextFunction, Request, Response } from "express";

import {
	parseSessionCookieHeader,
	verifySessionCookie,
} from "../utils/session-cookie.util.js";

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates `:session_id` is a real UUID (rejects literal "null" and malformed
 * identifiers). Feature-flagged via SESSION_COOKIE_SECRET:
 *  - unset → pass through (back-compat for legacy clients)
 *  - set   → require a matching signed `cs_session` cookie
 */
export function sessionAuth(
	req: Request,
	res: Response,
	next: NextFunction
): void {
	const paramId = req.params.session_id;

	if (typeof paramId !== "string" || paramId.length === 0 || paramId === "null") {
		res.status(400).json({ success: false, message: "Session ID is required" });
		return;
	}
	if (!UUID_RE.test(paramId)) {
		res.status(400).json({ success: false, message: "Invalid session ID" });
		return;
	}

	const secret = process.env.SESSION_COOKIE_SECRET;
	if (!secret) {
		next();
		return;
	}

	const cookie = parseSessionCookieHeader(req.headers.cookie);
	const cookieSessionId = verifySessionCookie(cookie, secret);

	if (!cookieSessionId) {
		res.status(401).json({ success: false, message: "Unauthenticated" });
		return;
	}
	if (cookieSessionId !== paramId) {
		res.status(403).json({ success: false, message: "Forbidden" });
		return;
	}

	next();
}
