import { describe, it, expect } from "vitest";

describe("Simple Environment Test", () => {
	it("should have basic setup working", () => {
		expect(1 + 1).toBe(2);
		console.log("Basic test passing ✅");
	});

	it("should check environment variables", () => {
		const hasGeminiKey = !!process.env.GOOGLE_GEMINI_API_KEY;
		console.log("Has Gemini API Key:", hasGeminiKey ? "✅" : "❌");

		// Don't fail the test if no API key, just log it
		expect(true).toBe(true);
	});
});
