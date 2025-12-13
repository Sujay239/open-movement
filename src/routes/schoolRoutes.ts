
import express, { Request, Response } from "express";
import  {authenticateToken}  from "../middlewares/authenticateToken"; // adjust path
import  decodeJwt  from "../middlewares/decodeToken"; // adjust path
import {pool} from "../db"; // your pg pool instance

const router = express.Router();

router.post(
  "/update",
  authenticateToken,
  async (req: Request, res: Response) => {
    const token = req.cookies?.token;

    try {
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const decoded: any = await decodeJwt(token);
      const schoolId = decoded?.id;

      if (!schoolId) {
        return res.status(401).json({ error: "Invalid token" });
      }

      // Acceptable fields from client
      const {
        name,
        contact_name,
        email,
        country,
        region,
        phone,
        address,
        city,
        website,
        description,
      } = req.body;

      // Basic validation
      if (!name || !contact_name || !email) {
        return res
          .status(400)
          .json({ error: "name, contact_name and email are required" });
      }

      // Start transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Check if email is being changed to an email already used by another school
        const emailCheck : any = await client.query(
          "SELECT id FROM schools WHERE email = $1 AND id <> $2 LIMIT 1",
          [email, schoolId]
        );
        if (emailCheck.rowCount > 0) {
          await client.query("ROLLBACK");
          return res
            .status(409)
            .json({ error: "Email already in use by another account" });
        }

        // Build dynamic update statement
        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        const add = (col: string, val: any) => {
          if (val !== undefined) {
            setClauses.push(`${col} = $${idx}`);
            values.push(val);
            idx++;
          }
        };

        add("name", name);
        add("contact_name", contact_name);
        add("email", email);
        add("country", country);
        add("region", region);
        add("phone", phone);
        add("address", address);
        add("city", city);
        add("website", website);
        add("description", description);


        if (setClauses.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "No valid fields provided" });
        }

        // Finalize query
        const query = `
          UPDATE schools
          SET ${setClauses.join(", ")}
          WHERE id = $${idx}
          RETURNING id, name, contact_name, email, country, region, phone, address, city, website, description, subscription_status, subscription_plan, subscription_started_at, subscription_end_at;
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
        console.error("Error updating school profile:", err);
        return res.status(500).json({ error: "Internal server error" });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Unexpected error in /update:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
