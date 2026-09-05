const format = (level: string, args: unknown[]) =>
  `[${new Date().toISOString()}] ${level}: ${args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}`;

export const logger = {
  info: (...args: unknown[]) => console.log(format('INFO', args)),
  warn: (...args: unknown[]) => console.warn(format('WARN', args)),
  error: (...args: unknown[]) => console.error(format('ERROR', args)),
};
