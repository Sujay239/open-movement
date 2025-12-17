import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db";
const cookieParser = require("cookie-parser");
import authRoutes from "./routes/Authentication";
import mail from "./routes/apiRoutes";
import verification from "./middlewares/verificationPage";
import adminAuthRoutes from "./routes/adminAuth";
import adminRoutes from "./routes/Admin";
import adminStats from "./routes/adminStats";
import adminAnalyticsRoutes from "./routes/AdminAnalytics";
import requestAnalyticsRoutes from "./routes/RequestAnalytics";
import teacherPortalRoutes from "./routes/portalTeachers";
import requestRoutes from "./routes/TeacherRequests";
import subscriptionMiddleware from "./middlewares/subscriptionMiddleware";
import stripeRotes from "./routes/payment";
import fs from "fs";
import path from "path";
import { sendMail } from "./utils/mailsender";
import { encodePass } from "./middlewares/passwordEconder";
import schoolRoutes from "./routes/schoolRoutes";
import decodeJwt from "./middlewares/decodeToken";
import { authenticateToken } from "./middlewares/authenticateToken";
// import fileUploader from "./routes/File";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(subscriptionMiddleware);

app.use("/stripe", stripeRotes);
//All Routes with their flags
app.use("/auth", authRoutes);

//Admin Auth routes
app.use("/adminAuth", adminAuthRoutes);

//Admin routes
app.use("/admin", adminRoutes);
app.use("/admin", adminStats);

//Admin requests routes
app.use("/admin/requests", requestAnalyticsRoutes);

//Admin analytics routes
app.use("/api/admin/analytics", adminAnalyticsRoutes);

//Teacher Portal routes
app.use("/portal/teachers", teacherPortalRoutes);

//Teacher Requests routes
app.use("/requests", requestRoutes);

//sending mail to verify email id
app.use("/api", mail);

app.use("/school", schoolRoutes);



// File uploader if needed
// app.use("/file", fileUploader);




// If using app directly:
app.get(
  "/subscription/status",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      if (!token) {
        return res.status(401).json({ error: "Unauthorized (no token)" });
      }

      // decodeJwt may throw if token invalid — we let catch handle it
      const data: any = await decodeJwt(token);

      if (!data?.id || !data?.email) {
        return res.status(401).json({ error: "Invalid token payload" });
      }

      const query =
        "SELECT subscription_status, subscription_end_at FROM schools WHERE id = $1 AND email = $2 LIMIT 1";
      const { rows } = await pool.query(query, [data.id, data.email]);

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "School not found" });
      }

      const row = rows[0];

      // Return end date in ISO format (null if none)
      return res.status(200).json({
        subscription_status: row.subscription_status ?? null,
        subscription_end_at:
          row.subscription_end_at != null
            ? new Date(row.subscription_end_at).toISOString()
            : null,
      });
    } catch (err: any) {
      console.error("Error fetching subscription status:", err);
      // If decodeJwt threw because token invalid, return 401 for clarity
      if (
        err?.message?.toLowerCase()?.includes("token") ||
        err?.name === "JsonWebTokenError"
      ) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.get("/verifyemail/:token", async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const result = await pool.query(
      "UPDATE schools SET verified = TRUE, verify_token = NULL WHERE verify_token = $1",
      [token]
    );

    if (result.rowCount === 0) {
      return res
        .status(400)
        .send(
          verification("error", "Invalid verification link or user not found.")
        );
    }

    // You can redirect to frontend success page instead
    return res.send(
      verification(
        "success",
        "Email verified successfully. You can now log in."
      )
    );
  } catch (err) {
    console.log(err);
    return res
      .status(400)
      .send(verification("error", "Invalid or expired verification link."));
  }
});

// SUCCESS
app.get("/success", (req, res) => {
  const filePath = path.join(__dirname, "views", "success.html");
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) return res.status(500).send("Error loading success page");
    res.send(html);
  });
});

// CANCEL
app.get("/cancel", (req, res) => {
  const filePath = path.join(__dirname, "views", "cancel.html");
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) return res.status(500).send("Error loading cancel page");
    res.send(html);
  });
});

// FAILURE (manual redirect from our code)
app.get("/payment-failed", (req, res) => {
  const filePath = path.join(__dirname, "views", "failure.html");
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) return res.status(500).send("Error loading failure page");
    res.send(html);
  });
});

app.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = await pool.query("SELECT id FROM schools WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).send("Email not found.");
    }
    // Generate a token and its expiration time
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
    // Store the token and expiration time in the database
    await pool.query(
      "UPDATE schools SET forgot_password_token = $1, forgot_password_expires_at = $2 WHERE email = $3",
      [token, expiresAt, email]
    );
    // Send the reset link via email
    const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;
    await sendMail(
      email,
      "Password Reset Request",
      `<p>You requested a password reset. Click link : ${resetLink} to reset your password. This link will expire in 1 hour.</p>`
    );
    res.send("Password reset link has been sent to your email.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error occurred while processing your request.");
  }
});

// Reset password endpoint
app.post("/reset-password/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    await pool.query("BEGIN");
    const result = await pool.query(
      "SELECT id, forgot_password_expires_at,email FROM schools WHERE forgot_password_token = $1",
      [token]
    );
    if (result.rows.length === 0) {
      await pool.query("ROLLBACK");
      return res.status(400).send("Invalid or expired token.");
    }
    const row = result.rows[0];
    if (new Date(row.forgot_password_expires_at) < new Date()) {
      await pool.query("ROLLBACK");
      return res.status(400).send("Token has expired.");
    }

    const hash = await encodePass(newPassword);
    // Update the password and clear the token fields
    await pool.query(
      "UPDATE schools SET password_hash = $1, forgot_password_token = NULL, forgot_password_expires_at = NULL WHERE id = $2",
      [hash, row.id]
    );

    await sendMail(
      result.rows[0].email,
      "Password Successfully Reset",
      `<p>Your password has been successfully reset. If you did not perform this action, please contact support immediately.</p>`
    );
    await pool.query("COMMIT");
    res.send("Password has been reset successfully.");
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Error occurred while resetting password.");
  }
});

app.post(
  "/subscription/cancel",
  authenticateToken,
  async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
      const token = req.cookies?.token;
      const decoded: any = await decodeJwt(token);
      const schoolId = decoded?.id;

      if (!schoolId) {
        return res.status(401).json({ error: "Invalid token" });
      }

      await client.query("BEGIN");

      // Check current subscription status
      const { rows } = await client.query(
        "SELECT subscription_status FROM schools WHERE id = $1",
        [schoolId]
      );

      if (rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "School not found" });
      }

      if (rows[0].subscription_status === "CANCELLED") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Subscription already cancelled",
        });
      }

      // Cancel subscription
      await client.query(
        `
        UPDATE schools
        SET
          subscription_status = 'NO_SUBSCRIPTION',
          subscription_plan = null,
          subscription_end_at = NOW()
        WHERE id = $1
        `,
        [schoolId]
      );

      // Expire access codes
      await client.query(
        `
        UPDATE access_codes
        SET status = 'EXPIRED'
        WHERE school_id = $1
        `,
        [schoolId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Subscription cancelled successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Cancel subscription error:", err);

      return res.status(500).json({
        error: "Internal server error",
      });
    } finally {
      client.release();
    }
  }
);


app.post("/use-access-code", async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const { rows } = await pool.query(
      "SELECT id FROM access_codes WHERE code = $1 AND status = 'UNUSED'",
      [code]
    );

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid or already used access code" });
    }

    return res.status(200).json({ message: "Access code is valid" });
  } catch (err) {
    console.error("Error verifying access code:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});




app.post("/contact/submit", async (req : Request, res  :Response) => {
  try {
    // 1. Destructure the data sent from the frontend
    const { name, email, phone, school, country, region, address, message } =
      req.body;
      
    if (!name || !email || !country) {
      return res
        .status(400)
        .json({ error: "Missing required fields (Name, Email, or Country)" });
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Contact Form Submission</h2>
        <p>You have received a new inquiry from the website contact form.</p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Full Name</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Email</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">
              <a href="mailto:${email}">${email}</a>
            </td>
          </tr>
          <tr style="background-color: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Phone</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${
              phone || "N/A"
            }</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Country</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${country}</td>
          </tr>
          <tr style="background-color: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Region</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${
              region || "N/A"
            }</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">School</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${
              school || "N/A"
            }</td>
          </tr>
          <tr style="background-color: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Address</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${
              address || "N/A"
            }</td>
          </tr>
        </table>

        <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #2563eb;">
          <strong>Message:</strong><br/>
          <p style="white-space: pre-wrap;">${
            message || "No message provided."
          }</p>
        </div>

        <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
          This email was sent from your website's contact form.
        </p>
      </div>
    `;

    // 4. Send the email to YOUR Admin Email
    // Replace 'process.env.ADMIN_EMAIL' with your actual admin email variable
    await sendMail(
      process.env.ADMIN_EMAIL || "admin@yourschool.com",
      `New Inquiry from ${name} - ${country}`,
      emailHtml
    );

    // 5. Send Success Response
    return res
      .status(200)
      .json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("Contact Form Error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
});




// app.delete("/delete-school", async (req: Request, res: Response) => {
//   try {
//     // const { email } = req.params;
//     await pool.query('TRUNCATE TABLE schools RESTART IDENTITY CASCADE');
//     res.send("Successfully deleted the school");
//   } catch (err) {
//     res.status(401).send("Error occurred in deleting school data.");
//   }
// });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// app.delete("/delete/:email", async (req: Request, res: Response) => {
//   try {
//     const { email } = req.params;

//     await pool.query("delete from schools where email = $1", [email]);
//     res.send("Successfully deleted the school");
//   } catch (err) {
//     res.status(401).send("Error occurred in deleting school data.");
//   }
// });
