// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		setupFiles: ["./test/setup.ts"], // ✅ This will load reflect-metadata
		coverage: {
			reporter: ["text", "json", "html"],
			exclude: ["node_modules/", "test/", "dist/", "**/*.d.ts"],
		},
		typecheck: {
			tsconfig: "./tsconfig.test.json",
		},
	},
});
