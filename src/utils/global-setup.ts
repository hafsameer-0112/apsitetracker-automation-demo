import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  const logsDir = path.resolve(__dirname, '../../logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const logFile = path.join(logsDir, `${stamp}.log`);

  // Touch the file so it exists even before the first log line is written
  fs.writeFileSync(logFile, '');

  // All worker processes inherit this env var and write to the same file
  process.env.PW_LOG_FILE = logFile;
}
