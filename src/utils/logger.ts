type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, msg: string, data?: Record<string, unknown>) {
  const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, msg };
  if (data) Object.assign(entry, data);
  console.log(JSON.stringify(entry));
}

export const logger = {
  info:  (msg: string, data?: Record<string, unknown>) => log('info', msg, data),
  warn:  (msg: string, data?: Record<string, unknown>) => log('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('error', msg, data),
  debug: (msg: string, data?: Record<string, unknown>) => log('debug', msg, data),
};
