import * as fs from 'fs';
import * as path from 'path';

function resolveLogFile(): string {
  if (process.env.PW_LOG_FILE) return process.env.PW_LOG_FILE;
  // Fallback if globalSetup didn't run (e.g. running a single file directly)
  const logsDir = path.resolve(__dirname, '../../logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  return path.join(logsDir, `${stamp}.log`);
}

const logStream = fs.createWriteStream(resolveLogFile(), { flags: 'a' });

function write(line: string): void {
  logStream.write(line + '\n');
}

export const logger = {
  info: (msg: string, meta?: unknown): void => {
    const time = new Date().toISOString();
    const line = `[INFO]  ${time}  ${msg}${meta !== undefined && meta !== '' ? '  ' + JSON.stringify(meta) : ''}`;
    console.log(line);
    write(line);
  },
  warn: (msg: string, meta?: unknown): void => {
    const time = new Date().toISOString();
    const line = `[WARN]  ${time}  ${msg}${meta !== undefined && meta !== '' ? '  ' + JSON.stringify(meta) : ''}`;
    console.warn(line);
    write(line);
  },
  error: (msg: string, meta?: unknown): void => {
    const time = new Date().toISOString();
    const line = `[ERROR] ${time}  ${msg}${meta !== undefined && meta !== '' ? '  ' + JSON.stringify(meta) : ''}`;
    console.error(line);
    write(line);
  },
};
