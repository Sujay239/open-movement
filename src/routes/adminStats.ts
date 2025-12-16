import { Request, Response } from "express";
import { Router } from "express";
import { pool } from "../db";
import { encodePass } from "../middlewares/passwordEconder";
import { authenticateToken } from "../middlewares/authenticateToken";
import passwordMatcher from "../middlewares/passwordMatch";
import { generateToken } from "../middlewares/generateToken";
import decodeJwt from "../middlewares/decodeToken";

const router = Router();


router.get("/dashboard/stats", authenticateToken , async (req, res) => {
  try {
    const token = req.cookies?.token;
    const isAdminUser: boolean = await isAdmin(token);
    if (!isAdminUser) {
      return res.status(403).send({ error: "Access denied. Admins only" });
    }
    const query = `
      SELECT
        (SELECT COUNT(*) FROM schools WHERE subscription_status = 'TRIAL') AS active_trials,
        (SELECT COUNT(*) FROM schools WHERE subscription_status = 'ACTIVE') AS paid_subscriptions,
        (SELECT COUNT(*) FROM schools) AS total_schools,
        (SELECT COUNT(*) FROM teachers WHERE profile_status = 'ACTIVE') AS total_teachers,
        (SELECT COUNT(*) FROM requests WHERE status = 'PENDING') AS pending_requests;
    `;

    const result = await pool.query(query);
    const stats = result.rows[0];

    res.json({
      activeTrials: parseInt(stats.active_trials),
      paidSubscriptions: parseInt(stats.paid_subscriptions),
      totalSchools: parseInt(stats.total_schools),
      totalTeachers: parseInt(stats.total_teachers),
      pendingRequests: parseInt(stats.pending_requests),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/dashboard/growth", authenticateToken, async (req, res) => {
  try {
   const token = req.cookies?.token;
   const isAdminUser: boolean = await isAdmin(token);
   if (!isAdminUser) {
     return res.status(403).send({ error: "Access denied. Admins only" });
   }

    const query = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as name,
        SUM(CASE WHEN type = 'teacher' THEN 1 ELSE 0 END) as teachers,
        SUM(CASE WHEN type = 'school' THEN 1 ELSE 0 END) as schools
      FROM (
        SELECT created_at, 'teacher' as type FROM teachers
        UNION ALL
        SELECT created_at, 'school' as type FROM schools
      ) as combined_data
      WHERE created_at > NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at);
    `;

    const result = await pool.query(query);

    // The result is already formatted exactly how Recharts needs it
    // e.g., [{ name: "Oct", teachers: 12, schools: 5 }, ...]
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/requests/recent", authenticateToken, async (req, res) => {
  try {
    const token = req.cookies?.token;
    const isAdminUser: boolean = await isAdmin(token);
    if (!isAdminUser) {
      return res.status(403).send({ error: "Access denied. Admins only" });
    }

    const query = `
      SELECT
        r.id,
        s.name AS "schoolName",
        t.teacher_code AS "teacherId",
        r.requested_at AS "time",
        r.status
      FROM requests r
      JOIN schools s ON r.school_id = s.id
      JOIN teachers t ON r.teacher_id = t.id
      ORDER BY r.requested_at DESC
      LIMIT 5;
    `;

    const result = await pool.query(query);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



// Helper function to check if the user is an admin
async function isAdmin(token: string): Promise<boolean> {
  const decodedTokenData: any = await decodeJwt(token);
  return decodedTokenData && decodedTokenData.role === "admin" ? true : false;
}

export default router;
