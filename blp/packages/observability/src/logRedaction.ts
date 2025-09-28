const sensitivePatterns = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{16}\b/g, // card
  /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g,
];

export function redactLog(message: string): string {
  return sensitivePatterns.reduce((acc, pattern) => acc.replace(pattern, '***REDACTED***'), message);
}

export function ensureNoPii(message: string): void {
  const redacted = redactLog(message);
  if (redacted !== message) {
    throw new Error('PII detected in log statement');
  }
}
