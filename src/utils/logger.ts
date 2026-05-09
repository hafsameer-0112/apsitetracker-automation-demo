/**
 * Tiny logger wrapper. Swap with winston/pino if you need structured logs.
 */
export const logger = {
  info: (msg: string, meta?: unknown): void => {
    const time = new Date().toISOString();
    console.log(`[INFO]  ${time}  ${msg}`, meta ?? '');
  },
  warn: (msg: string, meta?: unknown): void => {
    const time = new Date().toISOString();
    console.warn(`[WARN]  ${time}  ${msg}`, meta ?? '');
  },
  error: (msg: string, meta?: unknown): void => {
    const time = new Date().toISOString();
    console.error(`[ERROR] ${time}  ${msg}`, meta ?? '');
  },
};
