// routes/checkout.ts
import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import { authenticateToken } from "../middlewares/authenticateToken";
import decodeJwt from "../middlewares/decodeToken";
import { pool } from "../db";

dotenv.config();

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-11-17.clover",
  typescript: true,
});

// Helper: decide if user can buy the requested plan
function canBuyPlan(currentPlan: string | null, requestedPlan: string | null) {
  if (!requestedPlan) return { allowed: false, reason: "Missing planId" };

  // No active plan -> allow any
  if (!currentPlan) {
    return { allowed: true };
  }

  switch (currentPlan) {
    case "BASIC":
      if (requestedPlan === "PRO" || requestedPlan === "ULTIMATE") {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          "You already have BASIC. You can only upgrade to PRO or ULTIMATE.",
      };

    case "PRO":
      if (requestedPlan === "ULTIMATE") {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "You already have PRO. You can only upgrade to ULTIMATE.",
      };

    case "ULTIMATE":
      return {
        allowed: false,
        reason:
          "You already have ULTIMATE. You must cancel or let it expire before buying another plan.",
      };

    default:
      return {
        allowed: false,
        reason: "Unknown current subscription plan.",
      };
  }
}

router.post("/create-checkout-session", authenticateToken, async (req, res) => {
  try {
    const { priceId, planId } = req.body;

    if (!priceId || !planId) {
      return res.status(400).json({ error: "Missing priceId or planId" });
    }

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).send("No token provided.");
    }

    const data: any = await decodeJwt(token);
    const userId = data?.id;
    const email = data?.email;

    if (!userId) {
      return res.status(400).json({ error: "Invalid user" });
    }

    // 1️⃣ Get current subscription from DB
    const schoolResult = await pool.query(
      `
      SELECT subscription_status, subscription_end_at, subscription_plan
      FROM schools
      WHERE id = $1
      `,
      [userId]
    );

    let currentPlan: string | null = null;

    if (schoolResult.rows.length > 0) {
      const row = schoolResult.rows[0];

      // Example logic: treat non-ACTIVE or expired as "no current plan"
      const isActive =
        row.subscription_status === "ACTIVE" &&
        (!row.subscription_end_at ||
          new Date(row.subscription_end_at) > new Date());

      currentPlan = isActive ? row.subscription_plan : null;
    }

    //  Apply subscription plan rules
    const check = canBuyPlan(currentPlan, String(planId));

    if (!check.allowed) {
      return res.status(400).json({
        error: "Plan change not allowed",
        reason: check.reason,
      });
    }

    console.log(
      "Creating checkout session for user:",
      userId,
      "with email:",
      email,
      "currentPlan:",
      currentPlan,
      "requestedPlan:",
      planId
    );

    const clientUrl = process.env.CLIENT_URL || "https://example.com";

    // 3️⃣ Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${clientUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/cancel`,
      metadata: {
        userId: String(userId),
        planId: String(planId),
      },
      customer_email: email || undefined,
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error("STRIPE ERROR:", error.message);
    return res.status(500).json({
      error: "Error creating session",
      details: error.message,
    });
  }
});

export default router;
