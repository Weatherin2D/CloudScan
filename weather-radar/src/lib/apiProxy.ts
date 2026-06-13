/** Use the dev/prod server proxy instead of calling external APIs directly from the browser. */
export function proxiedApiBase(proxyPath: string, directUrl: string): string {
  if (import.meta.env.DEV || import.meta.env.VITE_USE_API_PROXY === "true") {
    return proxyPath;
  }
  return directUrl;
}
