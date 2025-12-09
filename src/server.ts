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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(subscriptionMiddleware);

app.use("/stripe", stripeRotes);
//All Routes with their flags
app.use("/auth", authRoutes);

//Admin Auth routes
app.use("/adminAuth", adminAuthRoutes);

//Admin routes
app.use("/admin", adminRoutes);

//Admin Analytics routes
app.use("/admin/requests", requestAnalyticsRoutes);

//Admin Analytics routes
app.use("/admin/views", adminAnalyticsRoutes);

//Teacher Portal routes
app.use("/portal/teachers", teacherPortalRoutes);

//Teacher Requests routes
app.use("/requests", requestRoutes);

//sending mail to verify email id
app.use("/api", mail);

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

app.post("/forgot-password/:email", async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
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

// app.delete("/delete-school/:email", async (req: Request, res: Response) => {
//   try {
//     const { email } = req.params;
//     await pool.query("DELETE FROM schools WHERE email = $1", [email]);
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
