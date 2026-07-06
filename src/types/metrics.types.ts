/**
 * Metrics Type Definitions
 *
 * Types for tracking and analyzing intelligent context management performance.
 */

/**
 * Context selection method used
 */
export type ContextMethod = "intelligent" | "simple";

/**
 * Metrics for a single context selection operation
 */
export interface ContextMetrics {
	/** Session identifier */
	sessionId: string;
	/** Method used for context selection */
	method: ContextMethod;
	/** Total conversation turns available */
	totalTurns: number;
	/** Number of turns actually selected */
	selectedTurns: number;
	/** Relevance scores for selected turns (only for intelligent method) */
	relevanceScores?: number[];
	/** Whether conversation summary was generated */
	hasSummary: boolean;
	/** Processing time in milliseconds */
	processingTimeMs: number;
	/** Timestamp of the operation */
	timestamp: Date;
}

/**
 * Aggregated metrics summary for a time period
 */
export interface ContextMetricsSummary {
	/** Time range for this summary (e.g., "24h", "7d", "30d") */
	timeRange: string;
	/** Total number of sessions */
	totalSessions: number;
	/** Number of sessions using intelligent context */
	intelligentCount: number;
	/** Number of sessions using simple context */
	simpleCount: number;
	/** Average total turns per session */
	averageTotalTurns: number;
	/** Average selected turns per session */
	averageSelectedTurns: number;
	/** Average processing time in milliseconds */
	averageProcessingTimeMs: number;
	/** Estimated token savings percentage */
	tokenSavingsPercent: number;
}

/**
 * Detailed metrics record for storage/retrieval
 */
export interface MetricsRecord extends ContextMetrics {
	/** Unique identifier for this metrics record */
	id: string;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Metrics query options
 */
export interface MetricsQueryOptions {
	/** Start time for metrics query */
	startTime?: Date;
	/** End time for metrics query */
	endTime?: Date;
	/** Filter by session ID */
	sessionId?: string;
	/** Filter by method */
	method?: ContextMethod;
	/** Maximum number of records to return */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}
