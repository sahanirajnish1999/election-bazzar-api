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

export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Access denied. No authorization token provided",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access denied. Token is missing",
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
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please login with a valid authorization token",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access token is missing in authorization header",
      });
      return;
    }

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
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
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

