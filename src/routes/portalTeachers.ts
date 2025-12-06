import { Request, Response } from "express";
import { Router } from "express";
import { pool } from "../db";
import { authenticateToken } from "../middlewares/authenticateToken";
import decodeJwt from "../middlewares/decodeToken";

const router = Router();

//   teacher_code, highest_qualification,current_country,current_region,years_experience
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rows } =
      await pool.query(`SELECT teacher_code,highest_qualification,years_experience FROM teachers WHERE profile_status <> 'INACTIVE' AND is_visible_in_school_portal = TRUE ORDER BY created_at DESC;
`);
    if (rows.length === 0) {
      return res.status(404).send({ error: "No teachers found" });
    }
    res.json(rows);
  } catch (error) {
    console.error("Error fetching teachers :", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT teacher_code,highest_qualification,current_country,current_region,years_experience,subjects FROM teachers WHERE profile_status <> 'INACTIVE' AND is_visible_in_school_portal = TRUE and id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).send({ error: "Teacher not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching teachers :", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

router.post('/:id/views', authenticateToken, async (req: Request, res: Response) => { 
  try {
    const teacherId = req.params.id;
    const token = req.cookies?.token;
    const { rows } = await pool.query("select * from teachers where id = $1", [teacherId]);
    if (rows.length === 0) {
      return res.status(404).send({ error: "Teacher not found" });
    }
    const data: any = await decodeJwt(token);
    if (!data || !data.id) {
      return res.status(401).send({ error: "Unauthorized" });
    }
    const schoolId = data.id;
    await pool.query(
      `INSERT INTO teacher_views (teacher_id, school_id, viewed_at) VALUES ($1, $2, NOW())`,
      [teacherId, schoolId]
    );
    res.status(201).send({ message: "View recorded successfully" });
  }catch (error) {
    console.error("Error recording teacher view:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

export default router;
