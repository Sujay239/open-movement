// src/routes/mail.ts
import { Router, Request, Response } from "express";
import { sendMail } from "../utils/mailsender";
import { pool } from "../db";

const router = Router();

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

export default router;
