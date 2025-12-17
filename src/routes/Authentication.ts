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
import { access } from "fs";
import { error } from "console";
const cookies = require("cookie-parser");

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(200),
  contact_name: z.string().optional().nullable(),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  country: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  access_code : z.string().optional().nullable()
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
      return res.status(409).send({
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
    ${process.env.FRONTEND} </p>` // or build nicer HTML
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
      return res.status(401).send({
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
    const client = await pool.connect();

    try {
      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Access code is required" });
      }

      const token = req.cookies?.token;
      const school: any = await decodeJwt(token);

      if (!school?.id) {
        return res.status(401).json({ error: "Invalid token" });
      }

      await client.query("BEGIN");

      const { rows: currentSchool } = await client.query(
        "select subscription_status,subscription_plan,subscription_end_at from schools where id = $1",
        [school.id]
      );

      if (
        currentSchool[0].subscription_status !== "NO_SUBSCRIPTION" ||
        currentSchool[0].subscription_plan !== null ||
        currentSchool[0].subscription_end_at !== null
      ) {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .send({ error: "You already use paid subscription" });
      }

      // 1️⃣ Check access code
      const { rows: codeRows } = await client.query(
        "SELECT * FROM access_codes WHERE code = $1",
        [code]
      );

      if (codeRows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Invalid access code" });
      }

      const accessCode = codeRows[0];

      // 2️⃣ Check if school already used a trial
      const { rows: schoolCodeRows } = await client.query(
        "SELECT 1 FROM access_codes WHERE school_id = $1",
        [school.id]
      );

      if (schoolCodeRows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "You already used your trial access.",
        });
      }

      // 3️⃣ Check code status
      if (accessCode.status !== "UNUSED") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Code is already used. Please try a different code.",
        });
      }

      // 4️⃣ Activate access code
      await client.query(
        `
        UPDATE access_codes
        SET
          first_used_at = NOW(),
          expires_at = NOW() + INTERVAL '24 hours',
          status = 'ACTIVE',
          school_id = $2
        WHERE code = $1
        `,
        [code, school.id]
      );

      // 5️⃣ Update school subscription
      await client.query(
        `
        UPDATE schools
        SET
          subscription_started_at = NOW(),
          subscription_end_at = NOW() + INTERVAL '24 hours',
          subscription_status = 'TRIAL'
        WHERE id = $1
        `,
        [school.id]
      );



      await client.query("COMMIT");

      return res.json({
        success: "Your trial period has started for 24 hours",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Use access code error:", err);
      return res.status(500).json({
        error: "Something went wrong. Please try again.",
      });
    } finally {
      client.release();
    }
  }
);


router.post("/register/code", async (req: Request, res: Response) => {
   const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: parse.error.issues });
    }


  const client = await pool.connect();
  try {
     const {
       name,
       contact_name,
       country,
       region,
       email,
       password,
       access_code,
     } = parse.data;

    await client.query("BEGIN");

    // 1. Validate access code (lock row to prevent reuse)


     const sch = await client.query(
       "SELECT * FROM schools WHERE email = $1 LIMIT 1",
       [email.trim().toLowerCase()]
     );
     if (sch.rows.length > 0) {
      await client.query('ROLLBACK');
       return res.status(409).send({
         error:
           "School with this email already exists. Please login and use the access code",
       });
     }

    const codeResult = await client.query(
      `
      SELECT id
      FROM access_codes
      WHERE code = $1
        AND status = 'UNUSED'
      FOR UPDATE
      `,
      [access_code]
    );

    if (codeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid or used access code." });
    }

    const accessCodeId = codeResult.rows[0].id;

    // 2. Hash password
    const passwordHash = await encodePass(password);

    const userResult = await client.query(
      `
      INSERT INTO schools (
        name,
        contact_name,
        country,
        region,
        email,
        password_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [name, contact_name, country, region, email.toLowerCase(), passwordHash]
    );

    const school = userResult.rows[0];

    // 4. Mark access code as used
   const result =  await client.query(
      `
       UPDATE access_codes
        SET
          first_used_at = NOW(),
          expires_at = NOW() + INTERVAL '24 hours',
          status = 'ACTIVE',
          school_id = $1
        WHERE code = $2
      `,
      [school.id, access_code]
    );

    if (result.rowCount !== 1) {
      return res.status(408).send("Access code update failed");
    }

    await client.query(`
      UPDATE schools
        SET
          subscription_started_at = NOW(),
          subscription_end_at = NOW() + INTERVAL '24 hours',
          subscription_status = 'TRIAL'
        WHERE id = $1
      ` , [school.id]);
         await sendMail(
           school.email,
           "Verify your email address",
           `<p>Hi ${school.name},
    Welcome to Open Movement! Please verify your email address to complete your registration.
    Click the link below to confirm your email: ${process.env.CLIENT_URL}/verifyemail/${school.verify_token}
    If you have any trouble with the link, please copy and paste it into your web browser's address bar.
    Thanks,
    The Open movement Team
    ${process.env.FRONTEND} </p>` // or build nicer HTML
         );
    await client.query("COMMIT");

    return res.status(201).json({
      message: "Registration successful. Please kindly login",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Internal server error." });
  } finally {
    client.release();
  }
});



router.post(
  "/update-password",
  authenticateToken,
  async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Both passwords are required" });
      }
        const token = req.cookies?.token;
        if(!token){
          return res.status(401).send({error : "Token not provided"});
        }
        const data = await decodeJwt(token);
      const email = data.email;

      await client.query("BEGIN");

      const { rows } = await client.query(
        "SELECT id, password_hash FROM schools WHERE email = $1",
        [email]
      );

      if (rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "School not found" });
      }

      const school = rows[0];

      // ✅ verify current password
      const isValid = await passwordMatcher(currentPassword, school.password_hash);

      if (!isValid) {
        await client.query("ROLLBACK");
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // ✅ hash new password
      const newHash = await encodePass(newPassword);

      const updateResult = await client.query(
        `
        UPDATE schools
        SET password_hash = $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [newHash, school.id]
      );

      if (updateResult.rowCount !== 1) {
        await client.query('ROLLBACK');
        return res.status(404).send({error : "Password update failed"});
      }

      await client.query("COMMIT");

      return res.json({ message: "Password updated successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      return res
        .status(500)
        .json({ error: "Internal server error. Please try again later." });
    } finally {
      client.release();
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
