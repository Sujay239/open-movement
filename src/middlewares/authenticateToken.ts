import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import decodeJwt from "./decodeToken";

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.token; // read cookie sent from client

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    jwt.verify(
      token,
      process.env.JWT_SECRET as string,
      (err: any, decoded: any) => {
        if (err) {
          return res.status(403).json({ error: "Invalid or expired token" });
        }

        // Attach decoded info to request for later use if needed
        (req as any).user = decoded;

        next(); // continue to protected route
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Unexpected error occurred" });
  }
}
