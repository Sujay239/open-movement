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

//Get all teachers
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

      const { rows } = await pool.query("SELECT * FROM teachers");
      res.json(rows);
    } catch (err) {
      res.status(500).send({ error: "Internal server error" });
    }
  }
);

// Add a new teachers
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
      } = req.body;

      await pool.query(
        `INSERT INTO teachers
           (teacher_code, full_name, email, phone, cv_link, current_job_title, subjects, highest_qualification, current_country, current_region, visa_status, notice_period, will_move_sem1, will_move_sem2, years_experience, preferred_regions, is_visible_in_school_portal) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
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
        ]
      );
      res.send({ success: "Teacher added successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: "Internal server error" });
    }
  }
);


router.post(
  "/teachers/bulk",
  authenticateToken,
  async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
      const token = req.cookies?.token;
      const isAdminUser: boolean = await isAdmin(token);

      if (!isAdminUser) {
        return res.status(403).json({
          error: "Access denied. Admins only",
        });
      }

      const { teachers } = req.body;

      if (!Array.isArray(teachers) || teachers.length === 0) {
        return res.status(400).json({
          error: "Teachers array is required",
        });
      }

      await client.query("BEGIN");

      const query = `
        INSERT INTO teachers
        (
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
          is_visible_in_school_portal
        )
        VALUES
        (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17
        )
      `;

      for (const teacher of teachers) {
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
        } = teacher;

        await client.query(query, [
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
        ]);
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: `${teachers.length} teachers added successfully`,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Bulk teacher insert error:", err);
      return res.status(500).json({
        error: "Internal server error",
      });
    } finally {
      client.release();
    }
  }
);


// // Get a specific teacher by ID
// router.get(
//   "/teachers/:id",
//   authenticateToken,
//   async (req: Request, res: Response) => {
//     try {
//       const token = req.cookies?.token;
//       const isAdminUser: boolean = await isAdmin(token);
//       if (!isAdminUser) {
//         return res.status(403).send({ error: "Access denied. Admins only" });
//       }
//       const { id } = req.params;
//       const { rows } = await pool.query(
//         "SELECT * FROM teachers WHERE id = $1",
//         [id]
//       );
//       if (rows.length === 0) {
//         return res.status(404).send({ error: "Teacher not found" });
//       }
//       res.json(rows[0]);
//     } catch (err) {
//       console.log(err);
//       res.status(500).send({ error: "Internal server error" });
//     }
//   }
// );

//Update a specific teacher by ID
router.patch(
  "/teachers/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;

      // 1. Move isAdmin check to a cleaner guard clause
      const isAdminUser: boolean = await isAdmin(token);
      if (!isAdminUser) {
        return res.status(403).send({ error: "Access denied. Admins only" });
      }

      const { id } = req.params;

      // 2. Fetch existing data
      const { rows } = await pool.query(
        "SELECT * FROM teachers WHERE id = $1",
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).send({ error: "Teacher not found" });
      }

      const existingTeacher = rows[0];

      // 3. Prepare data (Fallback to existing if body is undefined)
      // Note: removed teacher_code from here to prevent changing the ID
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
        years_experience = existingTeacher.years_experience,
        preferred_regions = existingTeacher.preferred_regions,
        is_visible_in_school_portal = existingTeacher.is_visible_in_school_portal,
      } = req.body;

      // 4. Update Query
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
        ]
      );

      // Return the updated object so the frontend can update its state immediately
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

// Archive (partially deleted) a teacher by ID (data remain preserve in archived_teachers table)
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

//Get all archieved teachers archived by the admin
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
          s.email AS school_name
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


// Get code details by code string
// router.get(
//   "/access-codes/:code",
//   authenticateToken,
//   async (req: Request, res: Response) => {
//     try {
//       const token = req.cookies?.token;
//       const isAdminUser: boolean = await isAdmin(token);
//       if (!isAdminUser) {
//         return res.status(403).send({ error: "Access denied. Admins only" });
//       }
//       const { code } = req.params;
//       if (!code) {
//         return res.status(400).send({ error: "Access code is required" });
//       }
//       const { rows } = await pool.query(
//         "select * from access_codes where code = $1",
//         [code]
//       );
//       if (rows.length === 0) {
//         return res.status(404).send({ error: "Access code not found" });
//       }
//       res.json(rows[0]);
//     } catch (err) {
//       console.log(err);
//       res.status(500).send({ error: "Internal server error" });
//     }
//   }
// );

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
router.get('/schools' , authenticateToken , async (req : Request , res : Response) => {
  try{
    const token = req.cookies?.token;
    const isAdminUser : boolean = await isAdmin(token);
    if(!isAdminUser) {
      return res.status(403).send({error : "Access denied. Admins only"});
    }
    const {rows} = await pool.query("select * from schools");
    res.json(rows);
  }catch(err) {
    console.log(err);
    res.status(500).send({error : "Internal server error"});
  }
});



// // Get a specific school by ID
// router.get('/school/:id' , authenticateToken , async (req : Request , res : Response) => {
//   try{
//     const token = req.cookies?.token;
//     const isAdminUser : boolean = await isAdmin(token);
//     if(!isAdminUser) {
//       return res.status(403).send({error : "Access denied. Admins only"});
//     }
//     const {id} = req.params;
//     const {rows} = await pool.query("select * from schools where id = $1" , [id]);
//     if(rows.length === 0) {
//       return res.status(404).send({error : "School not found"});
//     }
//     res.json(rows[0]);
//   }catch(err) {
//     console.log(err);
//     res.status(500).send({error : "Internal server error"});
//   }
// });


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
