import { Request, Response, NextFunction } from "express";
import { Admin, IAdmin } from "../models/Admin.Schema";
import { verifyAdminToken, verifyToken, UserTokenPayload } from "../utils/jwtHelper";

export interface IAuthUser {
  id: string;
  email?: string;
  role?: string;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: IAdmin;
      user?: IAuthUser;
    }
  }
}

export const extractTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === "string") {
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token) return token;
    } else if (authHeader.trim()) {
      return authHeader.trim();
    }
  }

  const xAuthToken = req.headers["x-auth-token"];
  if (xAuthToken && typeof xAuthToken === "string" && xAuthToken.trim()) {
    return xAuthToken.trim();
  }

  const tokenHeader = req.headers["token"];
  if (tokenHeader && typeof tokenHeader === "string" && tokenHeader.trim()) {
    return tokenHeader.trim();
  }

  const queryToken = req.query?.token;
  if (queryToken && typeof queryToken === "string" && queryToken.trim()) {
    return queryToken.trim();
  }

  return null;
};

export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access denied. No authorization token provided",
      });
      return;
    }

    const decoded = verifyAdminToken(token);

    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      res.status(401).json({
        success: false,
        message: "Admin account no longer exists",
      });
      return;
    }

    if (admin.status !== "active") {
      res.status(403).json({
        success: false,
        message: "Admin account is inactive. Please contact system administrator",
      });
      return;
    }

    req.admin = admin;
    req.user = {
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      name: admin.name,
    };
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authorization token",
    });
  }
};

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please login with a valid authorization token",
      });
      return;
    }

    try {
      const decoded: UserTokenPayload = verifyToken(token);
      const userId = (decoded.id || decoded.userId || decoded._id || decoded.sub) as string;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Invalid token payload: User ID missing",
        });
        return;
      }

      req.user = {
        id: String(userId),
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      };

      next();
      return;
    } catch {
      // Fallback: Check if valid admin token
      try {
        const adminDecoded = verifyAdminToken(token);
        if (adminDecoded && adminDecoded.id) {
          const admin = await Admin.findById(adminDecoded.id);
          if (admin && admin.status === "active") {
            req.admin = admin;
            req.user = {
              id: admin._id.toString(),
              email: admin.email,
              role: admin.role,
              name: admin.name,
            };
            next();
            return;
          }
        }
      } catch {
        // Fall through to error response
      }

      res.status(401).json({
        success: false,
        message: "Invalid or expired authorization token",
      });
    }
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authorization token",
    });
  }
};

export const optionalAuthenticateUser = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractTokenFromRequest(req);
    if (token) {
      try {
        const decoded: UserTokenPayload = verifyToken(token);
        const userId = (decoded.id || decoded.userId || decoded._id || decoded.sub) as string;
        if (userId) {
          req.user = {
            id: String(userId),
            email: decoded.email,
            role: decoded.role,
            name: decoded.name,
          };
        }
      } catch {
        try {
          const adminDecoded = verifyAdminToken(token);
          if (adminDecoded && adminDecoded.id) {
            const admin = await Admin.findById(adminDecoded.id);
            if (admin && admin.status === "active") {
              req.admin = admin;
              req.user = {
                id: admin._id.toString(),
                email: admin.email,
                role: admin.role,
                name: admin.name,
              };
            }
          }
        } catch {
          // Ignore invalid token in optional auth
        }
      }
    }
  } catch {
    // Ignore error for optional authentication
  }
  next();
};

export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.admin || req.admin.role !== "superadmin") {
    res.status(403).json({
      success: false,
      message: "Forbidden. Requires superadmin privileges",
    });
    return;
  }
  next();
};

