import { Request, Response } from "express";
import { Router } from "express";
import { pool } from "../db";
import { encodePass } from "../middlewares/passwordEconder";
import { authenticateToken } from "../middlewares/authenticateToken";
import passwordMatcher from "../middlewares/passwordMatch";
import { generateToken } from "../middlewares/generateToken";
import decodeJwt from "../middlewares/decodeToken";

const router = Router();

// ========================================================================================================
//        ADMIN - Teacher Management Routes
// ========================================================================================================

// Get all teachers
router.get(
  "/teachers",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const isAdminUser: boolean = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).send({ error: "Access denied. Admins only" });
      }

      const { rows } = await pool.query("SELECT * FROM teachers ORDER BY created_at DESC");
      res.json(rows);
    } catch (err) {
      res.status(500).send({ error: "Internal server error" });
    }
  }
);

// Add a new teacher
router.post(
  "/teachers",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const isAdminUser: boolean = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).send({ error: "Access denied. Admins only" });
      }
      const {
        teacher_code,
        full_name,
        email,
        phone,
        cv_link,
        current_job_title,
        subjects,
        highest_qualification,
        current_country,
        current_region,
        visa_status,
        notice_period,
        will_move_sem1 = false,
        will_move_sem2 = false,
        years_experience,
        preferred_regions,
        is_visible_in_school_portal = true,
        profile_status = "ACTIVE",
        current_school_name,
        bio = "",
      } = req.body;

      await pool.query(
        `INSERT INTO teachers
           (teacher_code, full_name, email, phone, cv_link, current_job_title, subjects, highest_qualification, current_country, current_region, visa_status, notice_period, will_move_sem1, will_move_sem2, years_experience, preferred_regions, is_visible_in_school_portal, profile_status,current_school_name,bio)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,$19,$20)`,
        [
          teacher_code,
          full_name,
          email,
          phone,
          cv_link,
          current_job_title,
          subjects,
          highest_qualification,
          current_country,
          current_region,
          visa_status,
          notice_period,
          will_move_sem1,
          will_move_sem2,
          years_experience,
          preferred_regions,
          is_visible_in_school_portal,
          profile_status,
          current_school_name,
          bio
        ]
      );
      res.send({ success: "Teacher added successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: "Internal server error" });
    }
  }
);

router.patch(
  "/teachers/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;

      const isAdminUser: boolean = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).send({ error: "Access denied. Admins only" });
      }

      const { id } = req.params;

      const { rows } = await pool.query(
        "SELECT * FROM teachers WHERE id = $1",
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).send({ error: "Teacher not found" });
      }

      const existingTeacher = rows[0];

      // Prepare data (Fallback to existing if body is undefined)
      const {
        full_name = existingTeacher.full_name,
        email = existingTeacher.email,
        phone = existingTeacher.phone,
        cv_link = existingTeacher.cv_link,
        current_job_title = existingTeacher.current_job_title,
        subjects = existingTeacher.subjects,
        highest_qualification = existingTeacher.highest_qualification,
        current_country = existingTeacher.current_country,
        current_region = existingTeacher.current_region,
        visa_status = existingTeacher.visa_status,
        notice_period = existingTeacher.notice_period,
        will_move_sem1 = existingTeacher.will_move_sem1,
        will_move_sem2 = existingTeacher.will_move_sem2,
        profile_status = existingTeacher.profile_status,
        years_experience = existingTeacher.years_experience,
        preferred_regions = existingTeacher.preferred_regions,
        is_visible_in_school_portal = existingTeacher.is_visible_in_school_portal,
        current_school_name = existingTeacher.current_school_name,
        bio = existingTeacher.bio,
      } = req.body;

      // Ensure parameters match SQL placeholders exactly
      // $17 is ID, $18 is profile_status
      const updateResult = await pool.query(
        `UPDATE teachers SET
          full_name = $1,
          email = $2,
          phone = $3,
          cv_link = $4,
          current_job_title = $5,
          subjects = $6,
          highest_qualification = $7,
          current_country = $8,
          current_region = $9,
          visa_status = $10,
          notice_period = $11,
          will_move_sem1 = $12,
          will_move_sem2 = $13,
          years_experience = $14,
          preferred_regions = $15,
          is_visible_in_school_portal = $16,
          profile_status = $18,
          current_school_name = $19,
          bio = $20,
          updated_at = NOW()
        WHERE id = $17
        RETURNING *;`,
        [
          full_name,
          email,
          phone,
          cv_link,
          current_job_title,
          subjects,
          highest_qualification,
          current_country,
          current_region,
          visa_status,
          notice_period,
          will_move_sem1,
          will_move_sem2,
          years_experience,
          preferred_regions,
          is_visible_in_school_portal,
          id,
          profile_status,
          current_school_name,
          bio
        ]
      );

      res.json({
        success: "Teacher updated successfully",
        data: updateResult.rows[0],
      });
    } catch (err) {
      console.error("Error updating teacher:", err);
      res.status(500).send({ error: "Internal server error" });
    }
  }
);

// Archive (partially deleted) a teacher by ID
router.delete(
  "/teachers/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const isAdminUser: boolean = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).send({ error: "Access denied. Admins only" });
      }
      const { id } = req.params;
      const deleteResult = await pool.query(
        "DELETE FROM teachers WHERE id = $1",
        [id]
      );
      if (deleteResult.rowCount === 0) {
        return res.status(404).send({ error: "Teacher not found" });
      }
      res.send({ success: "Teacher deleted successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: "Internal server error" });
    }
  }
);

//Get all archieved teachers
router.get(
  "/archived-teachers",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const isAdminUser: boolean = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).send({ error: "Access denied. Admins only" });
      }
      const { rows } = await pool.query("select * from archived_teachers");

      res.json(rows);
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: "Internal server error" });
    }
  }
);

// ========================================================================================================
//        ADMIN - Manage all access codes
// ========================================================================================================

// Get all acess codes
router.get(
  "/access-codes",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const isAdminUser: boolean = await isAdmin(token);

      if (!isAdminUser) {
        return res.status(403).json({ error: "Access denied. Admins only" });
      }

      const { rows } = await pool.query(`
        SELECT
          ac.id,
          ac.code,
          ac.status,
          ac.school_id,
          ac.first_used_at,
          ac.expires_at,
          ac.created_at,
          s.name AS school_name,
          s.email
        FROM access_codes ac
        LEFT JOIN schools s ON s.id = ac.school_id
        ORDER BY ac.created_at DESC
      `);

      res.json(rows);
    } catch (err) {
      console.error("Error fetching access codes:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Create a new access code
router.post(
  "/access-codes",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;

      // Admin check
      const isAdminUser = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).json({ error: "Access denied. Admins only" });
      }

      const { code } = req.body;

      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Access code is required" });
      }

      // Check duplicate code
      const { rows } = await pool.query(
        "SELECT 1 FROM access_codes WHERE code = $1 LIMIT 1",
        [code]
      );

      if (rows.length > 0) {
        return res.status(409).json({
          error: "Access code already exists",
        });
      }

      // Insert WITHOUT school_id
      await pool.query("INSERT INTO access_codes (code) VALUES ($1)", [code]);

      return res.status(201).json({
        success: "Access code created successfully",
      });
    } catch (err) {
      console.error("Create access code error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

//Mark as expired an access code by id
router.delete(
  "/access-codes/:code",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const isAdminUser: boolean = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).send({ error: "Access denied. Admins only" });
      }
      const { code } = req.params;
      const deleteResult = await pool.query(
        "update access_codes set status = 'EXPIRED' where id = $1",
        [code]
      );
      if (deleteResult.rowCount === 0) {
        return res.status(404).send({ error: "Access code not found" });
      }
      res.send({ success: "Access code deleted successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: "Internal server error" });
    }
  }
);

// ========================================================================================================
//        ADMIN - Schools routes
// ========================================================================================================

// Get all schools by Admin
router.get(
  "/schools",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const isAdminUser: boolean = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).send({ error: "Access denied. Admins only" });
      }
      const { rows } = await pool.query("select * from schools");
      res.json(rows);
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: "Internal server error" });
    }
  }
);

// Update subscription status of a school manually by Admin
router.patch(
  "/school/:id/subscription",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
      const isAdminUser: boolean = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).send({ error: "Access denied. Admins only" });
      }

      const { id } = req.params;

      // Expect body like:
      // { "subscription_status": "ACTIVE", "subscription_expires_at": 48 }
      let { subscription_status, subscription_expires_at } = req.body as {
        subscription_status: "TRIAL" | "ACTIVE" | "EXPIRED";
        subscription_expires_at: number | string;
      };

      // Basic validation
      if (!subscription_status) {
        return res
          .status(400)
          .send({ error: "subscription_status is required" });
      }

      if (!["TRIAL", "ACTIVE", "EXPIRED"].includes(subscription_status)) {
        return res
          .status(400)
          .send({ error: "Invalid subscription_status value" });
      }

      if (!subscription_expires_at) {
        return res
          .status(400)
          .send({ error: "subscription_expires_at (hours) is required" });
      }

      const hours = Number(subscription_expires_at);
      if (Number.isNaN(hours) || hours <= 0) {
        return res.status(400).send({
          error: "subscription_expires_at must be a positive number of hours",
        });
      }

      const updateResult = await pool.query(
        `
        UPDATE schools SET
          subscription_status      = $1,
          subscription_started_at  = NOW(),
          subscription_end_at      = NOW() + make_interval(hours => $2::int),
          updated_at               = NOW()
        WHERE id = $3
        RETURNING *;
      `,
        [subscription_status, hours, id]
      );

      if (updateResult.rowCount === 0) {
        return res.status(404).send({ error: "School not found" });
      }

      res.json(updateResult.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: "Internal server error" });
    }
  }
);




// Helper function to check if the user is an admin
async function isAdmin(token: string): Promise<boolean> {
  const decodedTokenData: any = await decodeJwt(token);
  return decodedTokenData && decodedTokenData.role === "admin" ? true : false;
}

export default router;
