// src/routes/mail.ts
import { Router, Request, Response } from "express";
import { sendMail } from "../utils/mailsender";
import { pool } from "../db";
import { Stripe } from "stripe";
import { authenticateToken } from "../middlewares/authenticateToken";

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



// Confirming for successful checkout & update the subscription of scholl in data base
router.post("/confirm-checkout", async (req, res) => {
  const client = await pool.connect();

  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed yet" });
    }

    const userId = session.metadata?.userId;
    const plan = session.metadata?.planId;

    if (!userId) {
      return res.status(400).json({ error: "No userId in session metadata" });
    }

    let endDate = new Date();
    if (plan === "BASIC") endDate.setMonth(endDate.getMonth() + 1);
    else if (plan === "PRO") endDate.setMonth(endDate.getMonth() + 6);
    else if (plan === "ULTIMATE") endDate.setMonth(endDate.getMonth() + 12);
    else return res.status(400).json({ error: "Invalid plan" });

    const query = `
      UPDATE SCHOOLS
      SET subscription_status = 'ACTIVE',
          subscription_plan = $4,
          subscription_started_at = NOW(),
          subscription_end_at = $1
      WHERE id = $2 AND email = $3
      RETURNING *
    `;

    await client.query("BEGIN");

    const { rows } = await client.query(query, [
      endDate,
      userId,
      session.customer_email,
      plan,
    ]);

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "School not found or update failed" });
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      userId,
      planId: plan,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
    });
  } catch (err: any) {
    console.error("Confirm checkout error:", err.message);
    try {
      await pool.query("ROLLBACK");
    } catch {}
    return res
      .status(500)
      .json({ error: "Internal error", details: err.message });
  }
});


router.post("/support/send-email", async (req : Request, res:Response) => {
  const { issueType, message } = req.body;

  await sendMail(
    "kotalsujay89@gmail.com",
    `Support Request: ${issueType}`,
    message,
  );

  res.json({ success: true });
});



export default router;
