import { Request, Response, Router } from "express";
import { pool } from "../db";
import { authenticateToken } from "../middlewares/authenticateToken";
import decodeJwt from "../middlewares/decodeToken";

const router = Router();

/**
 * GET all teacher requests for a school
 */
router.get(
  "/teachers",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const data: any = await decodeJwt(token);

      const query = `
        SELECT
          r.id,
          r.teacher_id,
          t.teacher_code,
          t.full_name,
          t.email,
          t.phone,
          t.cv_link,
          t.current_job_title,
          subjects,
          t.highest_qualification,
          t.current_country,
          t.current_region,
          t.visa_status,
          t.notice_period,
          t.will_move_sem1,
          t.will_move_sem2,
          t.years_experience,
          t.preferred_regions,
          t.profile_status,
          r.requested_at,
          r.status,
          r.school_message,
          r.school_id,
          COALESCE(r.admin_notes, 'No response by admin still now') AS admin_notes
        FROM requests r
        JOIN teachers t ON t.id = r.teacher_id
        WHERE r.school_id = $1
        ORDER BY r.requested_at DESC;
      `;

      const { rows } = await pool.query(query, [data.id]);

      const formatted = rows.map((r: any) => ({
        id: r.id,
        teacher_id: r.teacher_id,
        school_id: r.school_id,
        teacher_code: r.teacher_code,
        requested_at: r.requested_at, // ✅ RAW / ISO DATE
        status: r.status,
        school_message: r.school_message,
        admin_notes: r.admin_notes,
        subjects: r.subjects,
        teacher:
          r.status === "TEACHER_ACCEPTED"
            ? {
                full_name: r.full_name,
                email: r.email,
                phone: r.phone,
                cv_link: r.cv_link,
                current_job_title: r.current_job_title,
                highest_qualification: r.highest_qualification,
                current_country: r.current_country,
                current_region: r.current_region,
                visa_status: r.visa_status,
                notice_period: r.notice_period,
                will_move_sem1: r.will_move_sem1,
                will_move_sem2: r.will_move_sem2,
                years_experience: r.years_experience,
                preferred_regions: r.preferred_regions,
                profile_status: r.profile_status,
              }
            : null,
      }));

      return res.json(formatted);
    } catch (error) {
      console.error("Error fetching teacher requests:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET single request by ID
 */
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token;
    const data: any = await decodeJwt(token);
    const requestId = req.params.id;

    const query = `
        SELECT
          r.id,
          r.teacher_id,
          t.teacher_code,
          t.full_name,
          t.email,
          t.phone,
          t.cv_link,
          t.current_job_title,
          t.subjects,
          t.highest_qualification,
          t.current_country,
          t.current_region,
          t.visa_status,
          t.notice_period,
          t.will_move_sem1,
          t.will_move_sem2,
          t.years_experience,
          t.preferred_regions,
          t.profile_status,
          r.requested_at,
          r.status,
          r.school_message,
          COALESCE(r.admin_notes, 'No response by admin still now') AS admin_notes
        FROM requests r
        JOIN teachers t ON t.id = r.teacher_id
        WHERE r.id = $1 AND r.school_id = $2
        LIMIT 1;
      `;

    const { rows } = await pool.query(query, [requestId, data.id]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Request not found or not authorized" });
    }

    const r = rows[0];

    return res.json({
      id: r.id,
      teacher_id: r.teacher_id,
      teacher_code: r.teacher_code,
      requested_at: r.requested_at, // ✅ RAW / ISO DATE
      status: r.status,
      school_message: r.school_message,
      admin_notes: r.admin_notes,
      teacher:
        r.status === "TEACHER_ACCEPTED"
          ? {
              full_name: r.full_name,
              email: r.email,
              phone: r.phone,
              cv_link: r.cv_link,
              current_job_title: r.current_job_title,
              subjects: r.subjects,
              highest_qualification: r.highest_qualification,
              current_country: r.current_country,
              current_region: r.current_region,
              visa_status: r.visa_status,
              notice_period: r.notice_period,
              will_move_sem1: r.will_move_sem1,
              will_move_sem2: r.will_move_sem2,
              years_experience: r.years_experience,
              preferred_regions: r.preferred_regions,
              profile_status: r.profile_status,
            }
          : null,
    });
  } catch (error) {
    console.error("Error fetching request by id:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * CREATE request
 */
router.post(
  "/teachers/:teacherId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const data: any = await decodeJwt(token);
      const teacherId = req.params.teacherId;
      const { message } = req.body;

      const query = `
        INSERT INTO requests (teacher_id, school_id, school_message)
        VALUES ($1, $2, $3)
        RETURNING id, teacher_id, school_id, requested_at, status;
      `;

      const { rows } = await pool.query(query, [
        teacherId,
        data.id,
        message || "Interested in this teacher and would like to connect.",
      ]);

      return res.status(201).json({
        message: "Request sent successfully",
        request: rows[0],
      });
    } catch (error) {
      console.error("Error inserting request:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * CLOSE request (SECURED)
 */
router.delete(
  "/teachers/:id/:teacherId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const data: any = await decodeJwt(token);

      const { id, teacherId } = req.params;

      const query = `
        UPDATE requests
        SET status = 'CLOSED'
        WHERE id = $1 AND teacher_id = $2 AND school_id = $3
        RETURNING id;
      `;

      const result = await pool.query(query, [
        id,
        teacherId,
        data.id, 
      ]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Request not found or not authorized",
        });
      }

      return res.json({ message: "Request closed successfully" });
    } catch (error) {
      console.error("Error closing request:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
