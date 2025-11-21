import {db} from '../services/db';
import type {LogDefinition} from '@/types';

interface LogOptions {
  source?: string;
  data?: unknown;
  error?: Error;
  meta?: Record<string, unknown>;
  context?: string;
}

class Logger {
  private async writeLog(
    level: LogDefinition['level'],
    message: string,
    dataOrOptions?: unknown | LogOptions
  ): Promise<void> {
    try {
      // Handle both old console-style calls and new options-style calls
      let options: LogOptions = {};
      
      if (dataOrOptions) {
        // If it's already a LogOptions object (has known properties), use it
        if (typeof dataOrOptions === 'object') {
          const obj = dataOrOptions as Record<string, unknown>;
          if ('source' in obj || 'data' in obj || 'error' in obj || 'meta' in obj || 'context' in obj) {
            options = dataOrOptions as LogOptions;
          } else if (dataOrOptions instanceof Error) {
            // If it's an Error object, put it in the error field
            options = { error: dataOrOptions };
          } else {
            // Otherwise, treat it as data
            options = { data: dataOrOptions };
          }
        } else {
          // Primitive type, store as data
          options = { data: dataOrOptions };
        }
      }
      
      const logEntry: Omit<LogDefinition, 'id'> = {
        level,
        message,
        timestamp: new Date(),
        source: options.source,
        data: options.data ? JSON.stringify(options.data) : '{}',
        error: options.error?.message,
        stack: options.error?.stack,
        meta: options.meta ? JSON.stringify(options.meta) : undefined,
        context: options.context,
      };

      await db.log.add({
        id: crypto.randomUUID(),
        ...logEntry,
      });

      // Also log to console in development
      if (import.meta.env.DEV) {
        const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
        console[consoleMethod](`[${level}] ${message}`, dataOrOptions);
      }
    } catch (err) {
      // Fallback to console if database logging fails
      console.error('Failed to write to log database:', err);
      console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](message, dataOrOptions);
    }
  }

  trace(message: string, dataOrOptions?: unknown | LogOptions): void {
    void this.writeLog('TRACE', message, dataOrOptions);
  }

  debug(message: string, dataOrOptions?: unknown | LogOptions): void {
    void this.writeLog('DEBUG', message, dataOrOptions);
  }

  info(message: string, dataOrOptions?: unknown | LogOptions): void {
    void this.writeLog('INFO', message, dataOrOptions);
  }

  log(message: string, dataOrOptions?: unknown | LogOptions): void {
    // Alias for info
    void this.writeLog('INFO', message, dataOrOptions);
  }

  warn(message: string, dataOrOptions?: unknown | LogOptions): void {
    void this.writeLog('WARN', message, dataOrOptions);
  }

  error(message: string, dataOrOptions?: unknown | LogOptions): void {
    void this.writeLog('ERROR', message, dataOrOptions);
  }
}

// Export singleton instance
export const logger = new Logger();

// Also export individual methods for convenience
export const { trace, debug, info, log, warn, error } = logger;
