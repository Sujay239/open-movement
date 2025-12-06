import { Request, Response } from "express";
import { Router } from "express";
import { pool } from "../db";
import { authenticateToken } from "../middlewares/authenticateToken";
import decodeJwt from "../middlewares/decodeToken";

const router = Router();

// Get all stats teacher profile views (Admin only)
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(400).send("No token provided.");
    }
    const is_user_admin = await isAdmin(token);
    if (!is_user_admin) {
      return res.status(403).send({ error: "Access denied. Admins only." });
    }

    const query = `SELECT tv.id,tv.teacher_id,t.full_name AS teacher_name,t.teacher_code,tv.school_id,s.name AS school_name,tv.viewed_at FROM teacher_views tv LEFT JOIN teachers t ON t.id = tv.teacher_id LEFT JOIN schools s ON s.id = tv.school_id ORDER BY tv.viewed_at DESC;
        `;

    const { rows } = await pool.query(query);

    const formatted = rows.map((r: any) => ({
      id: r.id,
      teacher_id: r.teacher_id,
      teacher_name: r.teacher_name ?? null,
      teacher_code: r.teacher_code ?? null,
      school_id: r.school_id,
      school_name: r.school_name ?? null,
      viewed_at: r.viewed_at ? new Date(r.viewed_at).toLocaleString() : null,
    }));

    return res.send(formatted);
  } catch (err) {
    console.log(err);
    res.status(400).send({ error: "Something went wrong." });
  }
});

// Get analytics of teacher profile views by teacher ID (Admin only)
router.get(
  "/teachers/:teacherId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      if (!token) {
        return res.status(400).send("No token provided.");
      }
      const is_user_admin = await isAdmin(token);
      if (!is_user_admin) {
        return res.status(403).send({ error: "Access denied. Admins only." });
      }
      const { teacherId } = req.params;
  
        const query = `SELECT tv.id,tv.teacher_id,t.full_name AS teacher_name,t.teacher_code,tv.school_id,s.name AS school_name,tv.viewed_at FROM teacher_views tv LEFT JOIN teachers t ON t.id = tv.teacher_id LEFT JOIN schools s ON s.id = tv.school_id WHERE tv.teacher_id = $1 ORDER BY tv.viewed_at DESC;
        `;

      const { rows } = await pool.query(query, [teacherId]);
      const formatted = rows.map((r: any) => ({
        id: r.id,
        teacher_id: r.teacher_id,
        teacher_name: r.teacher_name ?? null,
        teacher_code: r.teacher_code ?? null,
        school_id: r.school_id,
        school_name: r.school_name ?? null,
        viewed_at: r.viewed_at ? new Date(r.viewed_at).toLocaleString() : null,
      }));
      return res.send(formatted);
    } catch (err) {
      console.log(err);
      res.status(400).send({ error: "Something went wrong." });
    }
  }
);

// All analytics of schools viewing a particular teacher profile (Admin only)
router.get(
  "/schools/:schoolId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      if (!token) {
        return res.status(400).send("No token provided.");
      }
      const is_user_admin = await isAdmin(token);
      if (!is_user_admin) {
        return res.status(403).send({ error: "Access denied. Admins only." });
      }
      const { schoolId } = req.params;

        const query = `SELECT tv.id,tv.teacher_id,t.full_name AS teacher_name,t.teacher_code,tv.school_id,s.name AS school_name,tv.viewed_at FROM teacher_views tv LEFT JOIN teachers t ON t.id = tv.teacher_id LEFT JOIN schools s ON s.id = tv.school_id WHERE tv.school_id = $1 ORDER BY tv.viewed_at DESC;
        `;

      const { rows } = await pool.query(query, [schoolId]);
      const formatted = rows.map((r: any) => ({
        id: r.id,
        teacher_id: r.teacher_id,
        teacher_name: r.teacher_name ?? null,
        teacher_code: r.teacher_code ?? null,
        school_id: r.school_id,
        school_name: r.school_name ?? null,
        viewed_at: r.viewed_at ? new Date(r.viewed_at).toLocaleString() : null,
      }));
      return res.send(formatted);
    } catch (err) {
      console.log(err);
      res.status(400).send({ error: "Something went wrong." });
    }
  }
);

// Helper function to check if the user is an admin
async function isAdmin(token: string): Promise<boolean> {
  const decodedTokenData: any = await decodeJwt(token);
  return decodedTokenData && decodedTokenData.role === "admin" ? true : false;
}
export default router;
