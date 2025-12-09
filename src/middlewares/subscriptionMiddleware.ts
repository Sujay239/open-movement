import { NextFunction, Request, Response } from "express";
import decodeJwt, { AppJwtPayload } from "./decodeToken";
import { pool } from "../db";

const ALLOWED_STATUSES = ["TRIAL", "ACTIVE"] as const;

const EXCLUDED_PATHS = [
  "/auth",
  "/admin",
  "/adminAuth",
  "/api",
  "/verifyemail",
  "/forgot-password",
  "/reset-password",
  "/stripe",
  "/success",
  "/cancel",
  "/payment-failed",
] as const;

function shouldSkip(path: string): boolean {
  return EXCLUDED_PATHS.some((route) => path.startsWith(route));
}

async function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip exempt routes
    if (shouldSkip(req.path)) {
      return next();
    }

    const token = req.cookies?.token;
    if (!token) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    let data: AppJwtPayload;
    try {
      data = await decodeJwt(token);
    } catch (err) {
      res.status(403).json({ message: "Invalid token" });
      return;
    }

    // bypass for admins
    if (data.role === "ADMIN") {
      return next();
    }

    const schoolId = data.id;
    if (!schoolId) {
      res.status(401).json({ message: "Invalid token structure" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT subscription_status, subscription_started_at, subscription_end_at
       FROM schools WHERE id = $1`,
      [schoolId]
    );

    if (rows.length === 0) {
      res.status(404).json({ message: "School not found" });
      return;
    }

    const {
      subscription_status,
      subscription_started_at,
      subscription_end_at,
    } = rows[0];

    // Check if dates exist
    if (!subscription_started_at || !subscription_end_at) {
      res.status(402).json({
        message: "Subscription not configured. Please purchase a subscription.",
        code: "SUBSCRIPTION_REQUIRED",
      });
      return;
    }

    // Check expiration
    if (new Date(subscription_end_at) < new Date()) {
      res.status(402).json({
        message: "Your subscription has expired. Please renew.",
        code: "SUBSCRIPTION_EXPIRED",
      });
      return;
    }

    if (!ALLOWED_STATUSES.includes(subscription_status)) {
      res.status(402).json({
        message: "You must purchase a subscription to access this resource.",
        code: "SUBSCRIPTION_REQUIRED",
      });
      return;
    }

    next();
  } catch (err) {
    console.error("Subscription check error:", err);
    res.status(500).json({
      message: "Server error during subscription check",
    });
  }
}

export default requireSubscription;
