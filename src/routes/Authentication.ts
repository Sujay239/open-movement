import { Request, Response } from "express";
import { z } from "zod";
import { Router } from "express";
import { pool } from "../db";
import { encodePass } from "../middlewares/passwordEconder";
import { authenticateToken } from "../middlewares/authenticateToken";
import passwordMatcher from "../middlewares/passwordMatch";
import { generateToken } from "../middlewares/generateToken";
import decodeJwt from "../middlewares/decodeToken";
import { JwtPayload, TokenExpiredError } from "jsonwebtoken";
import { sendMail } from "../utils/mailsender";
const cookies = require("cookie-parser");

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(200),
  contact_name: z.string().optional().nullable(),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  country: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.use(cookies());

//Register Users or schools
router.post("/register", async (req: Request, res: Response) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid input", details: parse.error.issues });
  }
  const { name, contact_name, email, password, country, region } = parse.data;
  try {
    const hash = await encodePass(password);
    const sch = await pool.query(
      "SELECT * FROM schools WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()]
    );
    if (sch.rows.length > 0) {
      return res
        .status(409)
        .send({
          error:
            "School with this email already exists. Try with different email address.",
        });
    }
    if (!hash) {
      return res.status(403).send({ error: "password not hashed" });
    }
    const normalEmail = email.trim().toLowerCase();
    await pool.query("BEGIN");
    await pool.query(
      `INSERT INTO schools (name ,contact_name, email , password_hash,country,region) VALUES ($1,$2,$3,$4,$5,$6)`,
      [name, contact_name, normalEmail, hash, country, region]
    );

    const { rows } = await pool.query(
      "SELECT * FROM schools WHERE email = $1 LIMIT 1",
      [normalEmail]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).send({
        error: `School not found associated with email: ${normalEmail} \n Please Register yourself first.`,
      });
    }

    const school = rows[0];

    await sendMail(
      normalEmail,
      "Verify your email address",
      `<p>Hi ${school.name},
    Welcome to Open Movement! Please verify your email address to complete your registration.
    Click the link below to confirm your email: ${process.env.CLIENT_URL}/verifyemail/${school.verify_token}
    If you have any trouble with the link, please copy and paste it into your web browser's address bar.
    Thanks,
    The Open movement Team
    http://loclahost:5173 </p>` // or build nicer HTML
    );

    res.send({
      successMsg:
        "Registration successful. Email for verification sent successfully.",
    });
    await pool.query("COMMIT");
  } catch (err) {
    console.log(err);
    res.status(401).send({ error: "Registration failed please try again " });
  }
});

//Login users or schools
router.post("/login", async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid input", details: parse.error.issues });
  }
  const { email, password } = parse.data;
  try {
    // 1. Find user by email
    const normalEmail = email.trim().toLowerCase();
    const { rows } = await pool.query(
      "SELECT * FROM schools WHERE email = $1 LIMIT 1",
      [normalEmail]
    );

    if (!rows || rows.length === 0) {
      return res
        .status(401)
        .send({
          error: `School not found associated with email: ${normalEmail} \n Please Register yourself first.`,
        });
    }

    const school = rows[0];

    // 2. Compare password (bcrypt)
    const isMatch = await passwordMatcher(password, school.password_hash); // passwordMatcher uses bcrypt.compare

    if (!isMatch) {
      return res.status(401).send({ error: "Invalid password" });
    }

    if (!school.verified) {
      return res.status(401).send({ error: "Please verify your email first." });
    }

    // 3. Generate token
    const token = await generateToken(school.id, school.name, school.email); // or user.id, etc.
    // const data = await decodeJwt(token);
    // console.log(data);

    res.cookie("token", token, {
      maxAge: 86400000,
    });

    return res.send({ success: "Login successful", accessToken: token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).send({ error: "Error occurred in login." });
  }
});

router.get("/me", authenticateToken, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(400).send("No token provided.");
    }

    const data: any = await decodeJwt(token);

    const school = await pool.query("select * from schools where id = $1", [
      data.id,
    ]);

    if (!school) {
      return res.send(400).send({ error: "Error in fetching school data" });
    }

    return res.send(school.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(400).send({ error: "Something went wrong." });
  }
});


router.get("/protect", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // decode & verify JWT
    const data: any = await decodeJwt(token);

    if (!data || !data.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // ROLE CHECK
    if (data.role === "admin") {
      return res.status(200).json({
        message: "Admin access granted",
        role: data.role,
        user: data,
      });
    }

    if (data.role === "school") {
      return res.status(200).json({
        message: "School access granted",
        role: data.role,
        user: data,
      });
    }

    // any other role = blocked
    return res.status(403).json({
      message: "Access denied",
    });
  } catch (err) {
    console.error(err);
    return res.status(401).json({
      message: "Token invalid or expired",
    });
  }
});


router.post("/isLoggedin", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        loggedIn: false,
        role: null,
      });
    }

    const decoded = await decodeJwt(token);
    return res.status(200).json({
      loggedIn: true,
      role: decoded.role,
    });
  } catch (err) {
    return res.status(401).json({
      loggedIn: false,
      role: null,
      message: "Invalid or expired token",
    });
  }
});

router.post(
  "/use-access-code",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      const token = req.cookies?.token;
      const school: any = await decodeJwt(token);

      await pool.query("BEGIN");

      const { rows } = await pool.query(
        "select * from access_codes where code = $1",
        [code]
      );
      const accessSchool = rows[0];

      if (accessSchool.status !== "UNUSED") {
        return res.status(409).send({
          error: "Code is already used. please try with different code.",
        });
      }

      if (accessSchool.school_id !== school.id) {
        return res
          .status(401)
          .send({ error: "Please use the coreect code to access" });
      }

      await pool.query(
        "update access_codes set first_used_at = NOW(), expires_at =  NOW() + INTERVAL '24 hours', status = 'ACTIVE' where code = $1",
        [code]
      );

      //Also update the school table to set subscription_started_at and subscription_end_at to time stamp
      await pool.query(
        "update schools set subscription_started_at = NOW(), subscription_end_at = NOW() + INTERVAL '24 hours', subscription_status = 'TRIAL' where id = $1",
        [school.id]
      );

      await pool.query("COMMIT");

      return res.send({ success: "Your Trial preriod started for 24-hours" });
    } catch (err) {
      console.log(err);
      await pool.query("ROLLBACK");
      res.status(401).send("Something went wrong please try again.");
    }
  }
);

router.post("/logout", (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    // If you also use a session cookie (optional)
    res.clearCookie("session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Error occurred while log out." });
  }
});

export default router;
