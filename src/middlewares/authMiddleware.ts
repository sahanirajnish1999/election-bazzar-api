import { Request, Response, NextFunction } from "express";
import { Admin, IAdmin } from "../models/Admin.Schema";
import { verifyAdminToken } from "../utils/jwtHelper";

declare global {
  namespace Express {
    interface Request {
      admin?: IAdmin;
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
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authorization token",
    });
  }
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
