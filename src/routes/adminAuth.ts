import { Request, Response } from "express";
import { Router } from "express";
import { pool } from "../db";
import { encodePass } from "../middlewares/passwordEconder";
import { authenticateToken } from "../middlewares/authenticateToken";
import passwordMatcher from "../middlewares/passwordMatch";
import { generateToken } from "../middlewares/generateToken";
import decodeJwt from "../middlewares/decodeToken";

const router = Router();
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
    try {
    const { rows } = await pool.query(
      "SELECT * FROM admins WHERE email = $1 LIMIT 1",
      [email]
    );
    if (!rows || rows.length === 0) {
      return res
        .status(401)
        .send({ error: `Admin not found associated with email: ${email}` });
    }
    const admin = rows[0];

    const isMatch = await passwordMatcher(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    const token = generateToken(admin.id, admin.name, admin.email, "admin");
    res.cookie("token", token, {
      maxAge: 86400000, // 24 hours
      httpOnly: true, // cannot be accessed by JavaScript (more secure)
      secure: true, // only sent over HTTPS
      sameSite: "strict", // restricts cross-site usage
    });
    res.json({ message: "Admin logged in successfully" });
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});



router.post("/register", async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
    try {
    const hashedPassword = await encodePass(password);

    await pool.query(
      "INSERT INTO admins (full_name, email, password_hash) VALUES ($1, $2, $3)",
      [name, email, hashedPassword]
    );
    res.json({ success: "Admin registered successfully" });
  } catch (error) {
    console.error("Error during admin registration:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});


export default router;
