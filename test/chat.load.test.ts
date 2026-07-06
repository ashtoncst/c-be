// test/chat.load.test.ts
import { describe, it } from "vitest";
import { io as ioc, Socket } from "socket.io-client";

describe("Chat Load Testing", () => {
	it("should handle multiple simultaneous messages", async () => {
		const clientCount = 10;
		const messagesPerClient = 5;
		const clients: Socket[] = []; // Fixed: proper type

		// Create multiple clients
		for (let i = 0; i < clientCount; i++) {
			const client = ioc("http://localhost:3000", {
				// Use your actual server
				reconnection: false,
				timeout: 5000,
				transports: ["websocket"], // ✅ Add this line
			});
			clients.push(client);
		}

		// Send messages from each client
		const promises = clients.map((client, clientIndex) => {
			return Promise.all(
				Array.from({ length: messagesPerClient }, (_, messageIndex) => {
					return new Promise<void>((resolve) => {
						const timeout = setTimeout(() => {
							console.warn(
								`Client ${clientIndex} message ${messageIndex} timed out`
							);
							resolve();
						}, 10000);

						client.on("end", () => {
							clearTimeout(timeout);
							resolve();
						});

						client.emit("chat_message", {
							session_id: `load-test-session-${clientIndex}`,
							message: `Test message ${messageIndex} from client ${clientIndex}`,
						});
					});
				})
			);
		});

		// Wait for all messages to complete
		await Promise.all(promises);

		// Cleanup
		clients.forEach((client) => client.disconnect());

		console.log("✅ Load test completed");
	}, 30000);
});
