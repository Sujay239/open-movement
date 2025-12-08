// src/routes/mail.ts
import { Router, Request, Response } from "express";
import { sendMail } from "../utils/mailsender";
import { pool } from "../db";
import { Stripe } from "stripe";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-11-17.clover", // or remove this line to rely on Dashboard default
  typescript: true,
});

router.post("/send-mail", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { rows } = await pool.query(
      "SELECT * FROM schools WHERE email = $1 LIMIT 1",
      [email]
    );

    const school = rows[0];

    await sendMail(
      email,
      "Verify your email address",
      `<p>Hi ${school.name},
Welcome to Open Movement! Please verify your email address to complete your registration.
Click the link below to confirm your email: http://localhost:5000/verifyemail/${school.verify_token}
If you have any trouble with the link, please copy and paste it into your web browser's address bar.
Thanks,
The Open movement Team
http://loclahost:5173 </p>` // or build nicer HTML
    );

    return res.json({ success: true, message: "Mail sent successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send mail" });
  }
});


router.post("/confirm-checkout", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    // 1. Get session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // 2. Check if payment is successful
    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed yet" });
    }

    // 3. Get userId that you set in metadata when creating the session
    const userId = session.metadata?.userId;
    const plan = session.metadata?.planId;

    if (!userId) {
      return res.status(400).json({ error: "No userId in session metadata" });
    }

    // 4. (OPTIONAL BUT IMPORTANT) Update your database here
    // You can store things like:
    // - stripeCustomerId: session.customer
    // - stripeSubscriptionId: session.subscription
    // - subscriptionActive: true
    //
    // Example pseudo-code (replace with your real DB logic):
    //
    // await db.user.update({
    //   where: { id: userId },
    //   data: {
    //     subscriptionActive: true,
    //     stripeCustomerId: session.customer?.toString(),
    //     stripeSubscriptionId: session.subscription?.toString(),
    //   },
    // });

    console.log("✅ Payment confirmed for user:", userId);

    return res.json({
      success: true,
      userId,
      planId: plan,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
    });
  } catch (err: any) {
    console.error("Confirm checkout error:", err.message);
    return res
      .status(500)
      .json({ error: "Internal error", details: err.message });
  }
});


export default router;
