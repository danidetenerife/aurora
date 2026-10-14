import { HifiLogger } from './types';

const noopLogger: HifiLogger = {
  trace: async () => {},
  debug: async () => {},
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

export class LoggerProvider {
  private static logger: HifiLogger = noopLogger;

  static init(logger: HifiLogger): void {
    LoggerProvider.logger = logger;
  }

  static get(): HifiLogger {
    return LoggerProvider.logger;
  }
}
