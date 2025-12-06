// subscriptionMiddleware.ts
import { NextFunction, Request, Response } from "express";
import decodeJwt from "./decodeToken";
import { pool } from "../db";

const ALLOWED_STATUSES = ["TRIAL", "ACTIVE"];

// Add any routes you want to bypass subscription checking
const EXCLUDED_PATHS = [
  "/auth",
  "/admin",
  "/adminAuth",
  "/api",
  "/verifyemail",
  "/forgot-password",
  "/webhook/stripe",
];

function shouldSkip(path: string) {
  return EXCLUDED_PATHS.some((route) => path.startsWith(route));
}

async function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Skip exempt routes
    if (shouldSkip(req.path)) {
      return next();
    }

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const data: any = await decodeJwt(token);

    // bypass for admins
    if (data.role === "ADMIN") {
      return next();
    }

    const schoolId = data.id;
    if (!schoolId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { rows } = await pool.query(
      `SELECT subscription_status, subscription_started_at, subscription_end_at
       FROM schools
       WHERE id = $1`,
      [schoolId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "School not found" });
    }

    const {
      subscription_status,
      subscription_started_at,
      subscription_end_at,
    } = rows[0];

    if (!subscription_started_at || !subscription_end_at) {
      return res.status(402).json({
        message: "Subscription not configured. Please purchase a subscription.",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    if (new Date(subscription_end_at) < new Date()) {
      return res.status(402).json({
        message: "Your subscription has expired. Please renew.",
        code: "SUBSCRIPTION_EXPIRED",
      });
    }

    if (!ALLOWED_STATUSES.includes(subscription_status)) {
      return res.status(402).json({
        message: "You must purchase a subscription to access this resource.",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    next();
  } catch (err) {
    console.error("Subscription check error:", err);
    return res.status(500).json({
      message: "Server error during subscription check",
    });
  }
}

export default requireSubscription;
