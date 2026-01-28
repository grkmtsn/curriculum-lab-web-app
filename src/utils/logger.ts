type LogLevel = 'info' | 'warn' | 'error';

export type LogPayload = Record<string, unknown>;

export function logInfo(event: string, payload: LogPayload = {}): void {
  writeLog('info', event, payload);
}

export function logWarn(event: string, payload: LogPayload = {}): void {
  writeLog('warn', event, payload);
}

export function logError(event: string, payload: LogPayload = {}): void {
  writeLog('error', event, payload);
}

export function logMetric(name: string, payload: LogPayload = {}): void {
  writeLog('info', `metric.${name}`, payload);
}

function writeLog(level: LogLevel, event: string, payload: LogPayload): void {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(entry));
    return;
  }

  console.log(JSON.stringify(entry));
}
