
import express, { Request, Response } from "express";
import  {authenticateToken}  from "../middlewares/authenticateToken"; // adjust path
import  decodeJwt  from "../middlewares/decodeToken"; // adjust path
import {pool} from "../db"; // your pg pool instance

const router = express.Router();

router.patch(
  "/update",
  authenticateToken,
  async (req: Request, res: Response) => {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const decoded: any = await decodeJwt(token);
      const schoolId = decoded?.id;

      if (!schoolId) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const {
        name,
        contact_name,
        email,
        website,
        description,
        phone,
        address,
        city,
        country,
        region,
      } = req.body;

      // Ensure PATCH has at least one field
      if (
        name === undefined &&
        contact_name === undefined &&
        email === undefined &&
        website === undefined &&
        description === undefined &&
        phone === undefined &&
        address === undefined &&
        city === undefined &&
        country === undefined &&
        region === undefined
      ) {
        return res.status(400).json({ error: "No valid fields provided" });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Email uniqueness check
        if (email !== undefined) {
          const emailCheck : any = await client.query(
            "SELECT id FROM schools WHERE email = $1 AND id <> $2 LIMIT 1",
            [email, schoolId]
          );

          if (emailCheck.rowCount > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Email already in use" });
          }
        }

        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        const add = (column: string, value: any) => {
          if (value !== undefined) {
            setClauses.push(`${column} = $${idx}`);
            values.push(value);
            idx++;
          }
        };

        add("name", name);
        add("contact_name", contact_name);
        add("email", email);
        add("website", website);
        add("about", description);
        add("phone", phone);
        add("address", address);
        add("city", city);
        add("country", country);
        add("region", region);

        const query = `
          UPDATE schools
          SET ${setClauses.join(", ")}, updated_at = NOW()
          WHERE id = $${idx}
          RETURNING
            id,
            name,
            contact_name,
            email,
            website,
            about,
            phone,
            address,
            city,
            country,
            region,
            subscription_status,
            subscription_plan,
            subscription_started_at,
            subscription_end_at;
        `;

        values.push(schoolId);

        const result = await client.query(query, values);

        await client.query("COMMIT");

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "School not found" });
        }

        return res.status(200).json({
          message: "Profile updated successfully",
          school: result.rows[0],
        });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Update error:", err);
        return res.status(500).json({ error: "Internal server error" });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Token error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post('/track-view/:teacherId', authenticateToken, async (req, res) => {
  try {

    const token = req.cookies?.token;

    const data = await decodeJwt(token);

    const schoolId = data.id;

    const { teacherId } = req.params;

    if (!teacherId) {
      return res.status(400).json({ error: "Teacher code is required" });
    }

    const query = `
      INSERT INTO teacher_views (school_id, teacher_id) values ($1,$2)
    `;

    const result = await pool.query(query, [schoolId, teacherId]);

    if (result.rowCount === 0) {

      return res.status(404).json({ error: "Teacher not found" });
    }

    res.json({ message: "View recorded successfully" });

  } catch (err) {
    console.error("Error tracking view:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
