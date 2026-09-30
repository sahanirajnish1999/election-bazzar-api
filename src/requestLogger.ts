import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    const statusEmoji = status >= 500 ? '🔥' : status >= 400 ? '⚠️' : '✅';

    console.log(
      `${statusEmoji} [${req.method}] ${req.originalUrl} - Status: ${status} (${duration}ms)`
    );
  });

  next();
};
