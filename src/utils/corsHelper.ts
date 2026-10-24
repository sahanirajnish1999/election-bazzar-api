export const isOriginAllowed = (origin: string): boolean => {
  const corsOrigin = process.env.CORS_ORIGIN;

  if (!corsOrigin) {
    return true;
  }

  const allowedOrigins = corsOrigin.split(",").map((item) => item.trim());

  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    return true;
  }

  // Automatically allow any localhost or 127.0.0.1 origin in development
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  return false;
};
