import { Request, Response } from "express";
import { Router } from "express";
import { pool } from "../db";
import decodeJwt from "../middlewares/decodeToken";
import { authenticateToken } from "../middlewares/authenticateToken";

const router = Router();



// Get all requests with teacher and school details
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).send({ error: "Unauthorized: No token provided" });
    }
    const isUserAdmin = await isAdmin(token);
    if (!isUserAdmin) {
      return res.status(403).send({ error: "Forbidden: Admins only" });
    }
    
    const { rows } = await pool.query(
      `SELECT
        r.id,
        r.teacher_id,
        r.school_id,
        r.status,
        r.admin_notes,
        r.school_message,
        r.requested_at,
        t.teacher_code,
        t.full_name as teacher_name,
        s.name as school_name
      FROM requests r
      LEFT JOIN teachers t ON r.teacher_id = t.id
      LEFT JOIN schools s ON r.school_id = s.id
      ORDER BY r.requested_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching request :", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// Get request by ID with teacher and school details
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).send({ error: "Unauthorized: No token provided" });
    }
    const isUserAdmin = await isAdmin(token);
    if (!isUserAdmin) {
      return res.status(403).send({ error: "Forbidden: Admins only" });
    }
    const { rows } = await pool.query(
      `SELECT
        r.id,
        r.teacher_id,
        r.school_id,
        r.status,
        r.admin_notes,
        r.requested_at,
        t.teacher_code,
        t.full_name as teacher_name,
        s.name as school_name
      FROM requests r
      LEFT JOIN teachers t ON r.teacher_id = t.id
      LEFT JOIN schools s ON r.school_id = s.id
      WHERE r.id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).send({ error: "Request not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching request by ID:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});




// Update request status and admin notes
router.patch("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, admin_notes = "" } = req.body;
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).send({ error: "Unauthorized: No token provided" });
    }
    const isUserAdmin = await isAdmin(token);
    if (!isUserAdmin) {
      return res.status(403).send({ error: "Forbidden: Admins only" });
    }

    const { rowCount } = await pool.query(
      "UPDATE requests SET status = $1, admin_notes = $2 WHERE id = $3",
      [status, admin_notes, id]
    );
    if (rowCount === 0) {
      return res.status(404).send({ error: "Request not found" });
    }
    res.send({ message: "Request updated successfully" });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// Helper function to check if the user is an admin
async function isAdmin(token: string): Promise<boolean> {
  const decodedTokenData: any = await decodeJwt(token);
  return decodedTokenData && decodedTokenData.role === "admin" ? true : false;
}

export default router;
