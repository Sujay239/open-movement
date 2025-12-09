import { Request, Response, NextFunction } from "express";
import decodeJwt, { AppJwtPayload } from "./decodeToken";

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip auth for Stripe webhook
  if (req.path.startsWith("/webhook/stripe")) {
    return next();
  }

  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = await decodeJwt(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}
