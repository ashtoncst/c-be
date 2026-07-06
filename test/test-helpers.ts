import { io as ioc } from "socket.io-client";
// test/test-helpers.ts
export const waitForServer = async (
	url: string,
	timeout = 30000
): Promise<boolean> => {
	const start = Date.now();

	while (Date.now() - start < timeout) {
		try {
			const response = await fetch(url);
			if (response.status < 500) {
				return true;
			}
		} catch {
			// Server not ready yet
		}

		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	return false;
};

export const createTestClient = (port: number = 3000) => {
	return ioc(`http://localhost:${port}`, {
		reconnection: false,
		timeout: 10000,
		transports: ["websocket"],
	});
};
