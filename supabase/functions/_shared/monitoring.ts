type SentryEvent = {
  message: string;
  level?: "fatal" | "error" | "warning" | "info";
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

type SentryDsnParts = {
  protocol: string;
  host: string;
  projectId: string;
  publicKey: string;
};

export function parseSentryDsn(dsn: string): SentryDsnParts | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const projectId = url.pathname.replace("/", "");
    if (!publicKey || !host || !projectId) return null;
    return { protocol: url.protocol.replace(":", ""), host, projectId, publicKey };
  } catch {
    return null;
  }
}

export async function captureSentry(dsn: string | undefined, event: SentryEvent) {
  if (!dsn) return;
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return;

  const url = `${parsed.protocol}://${parsed.host}/api/${parsed.projectId}/store/`;
  const authHeader = `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=aimh-edge/1.0`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": authHeader,
      },
      body: JSON.stringify({
        message: event.message,
        level: event.level || "error",
        tags: event.tags,
        extra: event.extra,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Avoid throwing in the main flow if Sentry fails.
  }
}
