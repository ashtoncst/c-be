// test/helpers/socket-debug.ts
import { Socket } from "socket.io";

export const debugSocket = (socket: Socket, label: string) => {
	const events = [
		"connect",
		"disconnect",
		"token",
		"recommendations",
		"end",
		"error",
	];

	events.forEach((event) => {
		socket.on(event, (data) => {
			console.log(`[${label}] ${event}:`, data);
		});
	});
};

// Usage
// debugSocket(clientSocket, "TestClient");
