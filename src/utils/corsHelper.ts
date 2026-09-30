export const isOriginAllowed = (origin: string): boolean => {
  const corsOrigin = process.env.CORS_ORIGIN;

  if (!corsOrigin) {
    return false;
  }

  const allowedOrigins = corsOrigin.split(",").map((item) => item.trim());

  return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
};
