export function getBaseUrl() {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3100/";

  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  if (!url.endsWith("/")) {
    url = `${url}/`;
  }

  return url;
}
