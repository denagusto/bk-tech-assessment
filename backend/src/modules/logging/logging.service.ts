import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import * as GelfPro from 'gelf-pro';
import { FastifyRequest } from 'fastify';

export interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  [key: string]: any;
}

export interface LogMetadata {
  level: string;
  message: string;
  context?: LogContext;
  timestamp?: string;
  service?: string;
  version?: string;
}

@Injectable()
export class LoggingService implements OnModuleInit, OnModuleDestroy {
  private logger: winston.Logger;
  private gelf: any;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.setupWinstonLogger();
    this.setupGraylogTransport();
  }

  async onModuleDestroy() {
    if (this.logger) {
      await this.logger.end();
    }
  }

  private setupWinstonLogger() {
    const logLevel = this.configService.get('logging.level') || 'info';
    const logDir = this.configService.get('logging.file.dir') || 'logs';

    // Console transport
    const consoleTransport = new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          let log = `${timestamp} [${level}]: ${message}`;
          if (context && Object.keys(context).length > 0) {
            log += ` | Context: ${JSON.stringify(context)}`;
          }
          if (Object.keys(meta).length > 0) {
            log += ` | Meta: ${JSON.stringify(meta)}`;
          }
          return log;
        })
      ),
    });

    // File transport with rotation
    const fileTransport = new DailyRotateFile({
      filename: `${logDir}/application-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    });

    // Error file transport
    const errorFileTransport = new DailyRotateFile({
      filename: `${logDir}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    });

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'flash-sale-backend',
        version: '1.0.0',
      },
      transports: [consoleTransport, fileTransport, errorFileTransport],
    });
  }

  private setupGraylogTransport() {
    const graylogHost = this.configService.get('logging.graylog.host');
    const graylogPort = this.configService.get('logging.graylog.port');

    if (graylogHost && graylogPort) {
      try {
        GelfPro.setConfig({
          adapterName: 'udp',
          adapterOptions: {
            host: graylogHost,
            port: graylogPort,
          },
        });

        this.gelf = GelfPro.getAdapter();
        this.logger.info('Graylog transport configured successfully');
      } catch (error) {
        this.logger.error('Failed to configure Graylog transport:', error);
      }
    }
  }

  private sendToGraylog(level: string, message: string, context?: LogContext) {
    if (this.gelf) {
      try {
        const gelfMessage = {
          version: '1.1',
          host: this.configService.get('logging.host') || 'localhost',
          short_message: message,
          level: this.getGraylogLevel(level),
          timestamp: Date.now() / 1000,
          _service: 'flash-sale-backend',
          _version: '1.0.0',
          ...context,
        };

        this.gelf.send(gelfMessage);
      } catch (error) {
        // Fallback to console if Graylog fails
        console.error('Graylog send failed:', error);
      }
    }
  }

  private getGraylogLevel(level: string): number {
    const levels: { [key: string]: number } = {
      error: 3,
      warn: 4,
      info: 6,
      debug: 7,
    };
    return levels[level] || 6;
  }

  // Main logging methods
  log(level: string, message: string, context?: LogContext) {
    this.logger.log(level, message, { context });
    this.sendToGraylog(level, message, context);
  }

  error(message: string, context?: LogContext, error?: Error) {
    const logContext = {
      ...context,
      stack: error?.stack,
      errorName: error?.name,
      errorMessage: error?.message,
    };
    
    this.logger.error(message, { context: logContext });
    this.sendToGraylog('error', message, logContext);
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn(message, { context });
    this.sendToGraylog('warn', message, context);
  }

  info(message: string, context?: LogContext) {
    this.logger.info(message, { context });
    this.sendToGraylog('info', message, context);
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug(message, { context });
    this.sendToGraylog('debug', message, context);
  }

  // HTTP request logging
  logHttpRequest(req: FastifyRequest, duration: number, statusCode: number) {
    const context: LogContext = {
      requestId: req.headers['x-request-id'] as string,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string,
      duration,
      statusCode,
      userId: (req.headers['x-user-id'] as string) || 'anonymous',
    };

    const level = statusCode >= 400 ? 'warn' : 'info';
    const message = `HTTP ${req.method} ${req.url} - ${statusCode} (${duration}ms)`;
    
    this.log(level, message, context);
  }

  // Business logic logging
  logPurchaseAttempt(userId: string, success: boolean, context?: LogContext) {
    const level = success ? 'info' : 'warn';
    const message = `Purchase attempt ${success ? 'succeeded' : 'failed'} for user: ${userId}`;
    
    this.log(level, message, {
      userId,
      purchaseSuccess: success,
      ...context,
    });
  }

  logStockUpdate(oldStock: number, newStock: number, context?: LogContext) {
    this.info('Stock updated', {
      oldStock,
      newStock,
      stockChange: newStock - oldStock,
      ...context,
    });
  }

  logSystemEvent(event: string, context?: LogContext) {
    this.info(`System event: ${event}`, context);
  }

  // Performance logging
  logPerformance(operation: string, duration: number, context?: LogContext) {
    const level = duration > 1000 ? 'warn' : 'info';
    this.log(level, `Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      ...context,
    });
  }

  // Error logging with context
  logError(error: Error, context?: LogContext) {
    this.error(error.message, context, error);
  }

  // Get Winston logger instance
  getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}
