const VERCEL_ORIGIN = /^https:\/\/[\w.-]+\.vercel\.app$/;

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  allowVercelPreviews: boolean,
): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (allowVercelPreviews && VERCEL_ORIGIN.test(origin)) return true;
  return false;
}
