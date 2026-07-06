// ✅ Import reflect-metadata FIRST
import "reflect-metadata";
import { vi, beforeEach } from "vitest";

// ✅ Mock environment variables using vi.mock
// Provide both default export and named export to satisfy ESM import styles
vi.mock("dotenv", () => ({
	default: { config: vi.fn() },
	config: vi.fn(),
}));

// ✅ Global test setup
beforeEach(() => {
	vi.clearAllMocks();
});
