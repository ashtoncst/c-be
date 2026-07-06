/**
 * Async utilities for Express and general async operations
 */

import { Request, Response, NextFunction } from "express";
import { Logger } from "./logger.js";

const logger = new Logger({ serviceName: "async-utils" });

// Define proper type for async request handlers
type AsyncRequestHandler = (
	req: Request,
	res: Response,
	next: NextFunction
) => Promise<void>;

/**
 * Wraps an async Express request handler to properly catch errors
 * @param fn The async request handler to wrap
 * @returns A wrapped function that properly catches errors
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
	// Fixed: Use proper type instead of Function
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};

/**
 * Runs multiple promises with a concurrency limit
 * @param tasks Array of functions that return promises
 * @param concurrency Maximum number of promises to run simultaneously
 * @returns Promise that resolves with the results of all tasks
 */
export async function withConcurrency<T>(
	tasks: Array<() => Promise<T>>,
	concurrency: number
): Promise<T[]> {
	const results: T[] = [];
	const runningTasks: Array<{ promise: Promise<void>; done: boolean }> = [];

	async function runTask(task: () => Promise<T>, index: number): Promise<void> {
		try {
			const result = await task();
			results[index] = result;
		} catch (error) {
			logger.error("Task failed in withConcurrency", error as Error);
			throw error;
		}
	}

	for (let i = 0; i < tasks.length; i++) {
		const taskPromise = runTask(tasks[i], i);
		const taskEntry = { promise: taskPromise, done: false };

		// When the task completes, mark it as done
		taskPromise
			.then(() => {
				taskEntry.done = true;
			})
			.catch(() => {
				taskEntry.done = true;
			});

		runningTasks.push(taskEntry);

		if (runningTasks.filter((t) => !t.done).length >= concurrency) {
			// Wait for any task to complete
			await Promise.race(
				runningTasks.filter((t) => !t.done).map((t) => t.promise)
			);

			// Clean up completed tasks
			for (let j = runningTasks.length - 1; j >= 0; j--) {
				if (runningTasks[j].done) {
					runningTasks.splice(j, 1);
				}
			}
		}
	}

	// Wait for any remaining tasks
	await Promise.all(runningTasks.map((t) => t.promise));
	return results;
}

/**
 * Adds timeout to a promise
 * @param promise The promise to add timeout to
 * @param ms Timeout in milliseconds
 * @param errorMessage Optional custom error message
 * @returns A promise that rejects if the timeout is reached
 */
export function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	errorMessage = "Operation timed out"
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new Error(errorMessage));
		}, ms);

		promise
			.then((result) => {
				clearTimeout(timeoutId);
				resolve(result);
			})
			.catch((error) => {
				clearTimeout(timeoutId);
				reject(error);
			});
	});
}

/**
 * Configuration for retry attempts with exponential backoff.
 */
export interface RetryConfig {
	maxRetries: number;
	initialDelay: number; // ms
	maxDelay: number; // ms
	factor?: number; // Optional: Multiplier for the delay, defaults to 2 in withRetry if not used directly
}

/**
 * Retry a function a specified number of times with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelay Initial delay in milliseconds (doubled each retry for exponential backoff)
 * @param maxDelay Maximum delay in milliseconds
 * @param operationName Name of the operation being retried
 * @returns Promise that resolves with the result or rejects after all retries
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	maxRetries: number,
	initialDelay: number,
	maxDelay: number,
	operationName = "withRetry"
): Promise<T> {
	let attempt = 0;
	let delay = initialDelay;
	let lastError: unknown = null;

	while (attempt < maxRetries) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			attempt++;
			if (attempt < maxRetries) {
				const message = `[Retry] ${operationName} failed (attempt ${attempt}/${maxRetries}): ${
					error instanceof Error ? error.message : String(error)
				}. Retrying in ${delay}ms...`;
				logger.warn(message, {
					error: error instanceof Error ? error.message : String(error),
				});
				await sleep(delay);
				delay = Math.min(delay * 2, maxDelay);
			}
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error(`[Retry] ${operationName} failed after ${maxRetries} attempts`);
}

/**
 * Simple promise-based sleep function
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));
