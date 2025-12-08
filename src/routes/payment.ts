// routes/checkout.ts
import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Initialize Stripe
// You can omit apiVersion to use your account default.
// If you specify it, make sure it's a real version from Stripe docs.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-11-17.clover", // or remove this line to rely on Dashboard default
  typescript: true,
});

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { priceId, userId, email, planId } = req.body;

    // 1. Basic validation
    if (!priceId || !userId || !planId) {
      res.status(400).json({ error: "Missing priceId, userId, or planId" });
      return;
    }

    // 2. Safe client URL
    const clientUrl = process.env.CLIENT_URL || "https://example.com";

    // 3. Create subscription Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      // For subscriptions, UPI is not supported as a recurring method.
      // So we only use cards here.
      payment_method_types: ["card","amazon_pay"],

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      // Redirect URLs
      success_url: `${clientUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/cancel`,

      // Track the user so you can link in webhooks
      metadata: {
          userId: String(userId),
          planId: String(planId),
      },

      // Optional: prefill email
      customer_email: email || undefined,
    });

    // 4. Return the hosted Stripe Checkout URL
    res.json({ url: session.url });
  } catch (error: any) {
    console.error("STRIPE ERROR:", error.message);
    res.status(500).json({
      error: "Error creating session",
      details: error.message,
    });
  }
});

export default router;
