// src/utils/logger.ts
/**
 * Logger utility for consistent logging across the application
 * This is a browser-compatible version that works in the frontend
 */

// Log levels
enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug',
  }
  
  // Logger configuration
  interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
  }
  
  // Default configuration
  const defaultConfig: LoggerConfig = {
    level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
    enableConsole: true,
  };
  
  // Logger class
  class Logger {
    private config: LoggerConfig;
  
    constructor(config: Partial<LoggerConfig> = {}) {
      this.config = { ...defaultConfig, ...config };
    }
  
    /**
     * Log error message
     * @param message Log message
     * @param meta Additional metadata
     */
    error(message: string, meta?: any): void {
      this.log(LogLevel.ERROR, message, meta);
    }
  
    /**
     * Log warning message
     * @param message Log message
     * @param meta Additional metadata
     */
    warn(message: string, meta?: any): void {
      this.log(LogLevel.WARN, message, meta);
    }
  
    /**
     * Log info message
     * @param message Log message
     * @param meta Additional metadata
     */
    info(message: string, meta?: any): void {
      this.log(LogLevel.INFO, message, meta);
    }
  
    /**
     * Log debug message
     * @param message Log message
     * @param meta Additional metadata
     */
    debug(message: string, meta?: any): void {
      this.log(LogLevel.DEBUG, message, meta);
    }
  
    /**
     * Internal log method
     * @param level Log level
     * @param message Log message
     * @param meta Additional metadata
     */
    private log(level: LogLevel, message: string, meta?: any): void {
      // Check if log level is enabled
      if (!this.isLevelEnabled(level)) {
        return;
      }
  
      // Format log entry
      const timestamp = new Date().toISOString();
      const formattedMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  
      // Log to console
      if (this.config.enableConsole) {
        switch (level) {
          case LogLevel.ERROR:
            console.error(formattedMessage, meta || '');
            break;
          case LogLevel.WARN:
            console.warn(formattedMessage, meta || '');
            break;
          case LogLevel.INFO:
            console.info(formattedMessage, meta || '');
            break;
          case LogLevel.DEBUG:
            console.debug(formattedMessage, meta || '');
            break;
        }
      }
    }
  
    /**
     * Check if log level is enabled
     * @param level Log level to check
     * @returns True if level is enabled
     */
    private isLevelEnabled(level: LogLevel): boolean {
      const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
      const configLevelIndex = levels.indexOf(this.config.level);
      const levelIndex = levels.indexOf(level);
      
      return levelIndex <= configLevelIndex;
    }
  
    /**
     * Update logger configuration
     * @param config New configuration
     */
    setConfig(config: Partial<LoggerConfig>): void {
      this.config = { ...this.config, ...config };
    }
  }
  
  // Export singleton instance
  export const logger = new Logger();