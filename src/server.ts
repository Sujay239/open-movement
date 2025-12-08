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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
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
        .send(verification("error" , "Invalid verification link or user not found."));
    }

    // You can redirect to frontend success page instead
    return res.send(verification("success" , "Email verified successfully. You can now log in."));
  } catch (err) {
    console.log(err);
    return res.status(400).send(verification("error" , "Invalid or expired verification link."));
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
