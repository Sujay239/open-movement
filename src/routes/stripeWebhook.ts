import { Request, Response } from "express";
import Stripe from "stripe";
import { pool } from "../db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-11-17.clover",
});

export default async function stripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    console.error("❌ Missing stripe-signature header");
    console.log("Headers received:", req.headers);
    return res.status(400).send("Missing stripe-signature");
  }

  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET not set in env");
    return res.status(500).send("Missing webhook secret");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("✅ Stripe event received:", event.type);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email;

      console.log("checkout.session.completed for email:", email);

      if (email) {
        const { rows } = await pool.query(
          "SELECT id FROM schools WHERE email = $1",
          [email]
        );

        if (rows.length === 0) {
          console.warn("No school found with email:", email);
        } else {
          const schoolId = rows[0].id;
          console.log("Updating subscription for school:", schoolId);

          // Simple example: 30-day subscription after purchase
          await pool.query(
            `
              UPDATE schools
              SET
                subscription_status = 'ACTIVE',
                subscription_started_at = NOW(),
                subscription_end_at = NOW() + INTERVAL '30 days',
                updated_at = NOW()
              WHERE id = $1
            `,
            [schoolId]
          );
        }
      }
    }

    // You can handle other events here if needed

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Error handling Stripe webhook:", err);
    return res.status(500).send("Webhook handler failed");
  }
}
