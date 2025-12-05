import { Request, Response } from "express";
import { Router } from "express";
import { pool } from "../db";
import { authenticateToken } from "../middlewares/authenticateToken";

const router = Router();

//   teacher_code, highest_qualification,current_country,current_region,years_experience
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rows } =
      await pool.query(`SELECT teacher_code,highest_qualification,years_experience FROM teachers WHERE profile_status <> 'inactive' AND is_visible_in_school_portal = TRUE ORDER BY created_at DESC;
`);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching teachers :", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT teacher_code,highest_qualification,current_country,current_region,years_experience,subjects FROM teachers WHERE profile_status <> 'inactive' AND is_visible_in_school_portal = TRUE where id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching teachers :", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

export default router;
