export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, event: string, context: Record<string, unknown> = {}) {
  const payload = JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...context });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}
