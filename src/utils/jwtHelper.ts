import jwt, { JwtPayload, Secret, SignOptions } from "jsonwebtoken";

export interface AdminTokenPayload extends JwtPayload {
  id: string;
  role: string;
  email: string;
}

export interface UserTokenPayload extends JwtPayload {
  id: string;
  userId?: string;
  _id?: string;
  email?: string;
  role?: string;
  name?: string;
}

const getJwtSecret = (): Secret => {
  return process.env.JWT_SECRET || "election_api_super_secret_jwt_key_2026";
};

export const generateAdminToken = (payload: {
  id: string;
  role: string;
  email: string;
}): string => {
  const secret = getJwtSecret();
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

  return jwt.sign(payload, secret, {
    expiresIn,
  } as SignOptions);
};

export const generateUserToken = (payload: {
  id: string;
  email?: string;
  role?: string;
  name?: string;
}): string => {
  const secret = getJwtSecret();
  const expiresIn = (process.env.JWT_EXPIRES_IN || "30d") as SignOptions["expiresIn"];

  return jwt.sign(payload, secret, {
    expiresIn,
  } as SignOptions);
};

export const verifyAdminToken = (token: string): AdminTokenPayload => {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);
  return decoded as unknown as AdminTokenPayload;
};

export const verifyToken = (token: string): UserTokenPayload => {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);
  return decoded as unknown as UserTokenPayload;
};

