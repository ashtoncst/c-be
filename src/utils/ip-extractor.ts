import { Socket } from "socket.io";

/**
 * Extract the client's real IP address from a Socket.IO socket,
 * accounting for reverse proxies (Cloud Run, nginx, etc.).
 */
export function extractClientIp(socket: Socket): string {
	const forwarded = socket.handshake.headers["x-forwarded-for"];
	return typeof forwarded === "string"
		? forwarded.split(",")[0].trim()
		: socket.handshake.address;
}
