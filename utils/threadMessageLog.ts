const PREFIX = "[ThreadMessage]";

export type UrlSummary = {
  protocol?: string;
  host?: string;
  pathname?: string;
  searchLen: number;
  hrefLen: number;
};

export function summarizeRequestUrl(url: string): UrlSummary {
  try {
    const u = new URL(url);
    return {
      protocol: u.protocol,
      host: u.host,
      pathname: u.pathname,
      searchLen: u.search.length,
      hrefLen: url.length,
    };
  } catch {
    return { hrefLen: url.length, searchLen: 0 };
  }
}

export function logThreadMessage(
  event: string,
  detail: Record<string, unknown>,
): void {
  console.log(PREFIX, event, detail);
}
