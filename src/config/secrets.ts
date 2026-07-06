import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { ServiceAccountCredentials } from "../types/google-cloud.types.js";

export class SecretsManager {
	private static instance: SecretsManager;
	private client: SecretManagerServiceClient;
	private cache: Map<string, { value: string; timestamp: number }>;
	private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
	private readonly PROJECT_ID = "ph-senate"; // Replace with your GCP project ID
	private initialized: boolean = false;

	private constructor() {
		this.client = new SecretManagerServiceClient();
		this.cache = new Map();
		this.initialized = true;
	}

	public static getInstance(): SecretsManager {
		if (!SecretsManager.instance) {
			SecretsManager.instance = new SecretsManager();
		}
		return SecretsManager.instance;
	}

	private async getSecretFromManager(secretName: string): Promise<string> {
		try {
			const name = `projects/${this.PROJECT_ID}/secrets/${secretName}/versions/latest`;
			const [version] = await this.client.accessSecretVersion({ name });

			if (!version.payload?.data) {
				throw new Error(`Secret ${secretName} not found or empty`);
			}

			return version.payload.data.toString();
		} catch (error) {
			console.error(`Error fetching secret ${secretName}:`, error);
			throw error;
		}
	}

	private getCachedSecret(secretName: string): string | null {
		const cached = this.cache.get(secretName);
		if (!cached) return null;

		const now = Date.now();
		if (now - cached.timestamp > this.CACHE_TTL) {
			this.cache.delete(secretName);
			return null;
		}

		return cached.value;
	}

	private setCachedSecret(secretName: string, value: string): void {
		this.cache.set(secretName, {
			value,
			timestamp: Date.now(),
		});
	}

	public async getSecret(secretName: string): Promise<string> {
		// Check cache first
		const cached = this.getCachedSecret(secretName);
		if (cached) return cached;

		// Fetch from Secret Manager if not in cache
		const value = await this.getSecretFromManager(secretName);
		this.setCachedSecret(secretName, value);
		return value;
	}

	public async getDatabaseCredentials(): Promise<{
		user: string;
		password: string;
		credentials: ServiceAccountCredentials;
	}> {
		const [dbKey, user, password] = await Promise.all([
			this.getSecret("senate-dev-db-key"),
			process.env.DB_USER || this.getSecret("senate-db-user"),
			process.env.DB_PASSWORD || this.getSecret("senate-db-password"),
		]);

		return {
			user,
			password,
			credentials: JSON.parse(dbKey),
		};
	}

	public async getStorageCredentials(): Promise<ServiceAccountCredentials> {
		const storageKey = await this.getSecret("senate-dev-sa-key");
		return JSON.parse(storageKey);
	}

	public isInitialized(): boolean {
		return this.initialized;
	}

	public async testConnection(): Promise<boolean> {
		try {
			// Try to access a simple secret or list secrets to verify connectivity
			const parent = `projects/${this.PROJECT_ID}`;
			await this.client.listSecrets({ parent });
			return true;
		} catch (error) {
			console.error("Secret Manager connection test failed:", error);
			this.initialized = false;
			return false;
		}
	}
}
