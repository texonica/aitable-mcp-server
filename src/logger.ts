import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

/**
 * Logger for AITable MCP Server
 * Handles logging to both console and file
 */
export class Logger {
  private logDir: string;
  private logFile: string;
  private debugMode: boolean;
  private static instance: Logger;

  private constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirExists();
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    this.logFile = path.join(this.logDir, `aitable-mcp-${timestamp}.log`);
    this.debugMode = process.env.LOG_LEVEL === 'debug';
    
    this.info(`Logger initialized. Debug mode: ${this.debugMode}`);
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private ensureLogDirExists(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: string, message: string, obj?: any): string {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (obj !== undefined) {
      try {
        const objString = typeof obj === 'string' ? obj : util.inspect(obj, { depth: 5, colors: false });
        logMessage += `\n${objString}`;
      } catch (err) {
        logMessage += `\n[Error formatting object: ${err instanceof Error ? err.message : String(err)}]`;
      }
    }
    
    return logMessage;
  }

  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (err) {
      console.error(`Failed to write to log file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Log debug information (only if debug mode is enabled)
   */
  debug(message: string, obj?: any): void {
    if (!this.debugMode) return;
    
    const formattedMessage = this.formatMessage('DEBUG', message, obj);
    console.debug(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  /**
   * Log general information
   */
  info(message: string, obj?: any): void {
    const formattedMessage = this.formatMessage('INFO', message, obj);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  /**
   * Log warnings
   */
  warn(message: string, obj?: any): void {
    const formattedMessage = this.formatMessage('WARN', message, obj);
    console.warn(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  /**
   * Log errors
   */
  error(message: string, obj?: any): void {
    const formattedMessage = this.formatMessage('ERROR', message, obj);
    console.error(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  /**
   * Log API request information
   */
  logApiRequest(method: string, url: string, headers: object, body?: any): void {
    this.debug(`API Request: ${method} ${url}`, {
      headers: this.sanitizeHeaders(headers),
      body: body
    });
  }

  /**
   * Log API response information
   */
  logApiResponse(url: string, status: number, headers: object, body: any): void {
    this.debug(`API Response: ${status} ${url}`, {
      headers,
      body: this.truncateResponseBody(body)
    });
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    if (sanitized.Authorization) {
      sanitized.Authorization = 'Bearer [REDACTED]';
    }
    return sanitized;
  }

  /**
   * Truncate large response bodies to avoid filling the log file
   */
  private truncateResponseBody(body: any): any {
    if (typeof body === 'string') {
      return body.length > 2000 ? body.substring(0, 2000) + '... [truncated]' : body;
    }
    return body;
  }
} 