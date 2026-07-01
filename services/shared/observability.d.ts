export interface Logger {
    info(message: string, metadata?: Record<string, unknown>): void;
    warn(message: string, metadata?: Record<string, unknown>): void;
    error(message: string, metadata?: Record<string, unknown>): void;
}
export declare function createLogger(module: string): Logger;
export declare function generateCorrelationId(): string;
export declare function incrementCounter(name: string, labels?: Record<string, string>): void;
export declare function getCounterValue(name: string, labels?: Record<string, string>): number;
export declare function getAllCounters(): Array<{
    name: string;
    value: number;
    labels: Record<string, string>;
}>;
