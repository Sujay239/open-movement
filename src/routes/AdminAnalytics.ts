import { Request, Response } from "express";
import { Router } from "express";
import { pool } from "../db";;
import { authenticateToken } from "../middlewares/authenticateToken";
import decodeJwt from "../middlewares/decodeToken";

const router = Router();


// Get all stats teacher profile views (Admin only)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(400).send("No token provided.");
        }
        const is_user_admin = await isAdmin(token);
        if (!is_user_admin) {
            return res.status(403).send({ error: "Access denied. Admins only." });
        }
        const { rows } = await pool.query(`SELECT * FROM teacher_views;`);
        return res.send(rows);
    } catch (err) {
        console.log(err);
        res.status(400).send({ error: "Something went wrong." });
    }
});



// Get analytics of teacher profile views by teacher ID (Admin only)
router.get('/teachers/:teacherId', authenticateToken, async (req: Request, res: Response) => {
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
        const { rows } = await pool.query(`SELECT id,teacher_id,school_id,viewed_at FROM teacher_views WHERE teacher_id = $1 ORDER BY viewed_at DESC;`, [teacherId]);
        return res.send(rows);
    } catch (err) {
        console.log(err);
        res.status(400).send({ error: "Something went wrong." });
    }
});



// All analytics of schools viewing a particular teacher profile (Admin only)
router.get('/schools/:schoolId', authenticateToken, async (req: Request, res: Response) => {
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
        const { rows } = await pool.query(`SELECT id,teacher_id,school_id,viewed_at FROM teacher_views WHERE school_id = $1 ORDER BY viewed_at DESC;`, [schoolId]);
        return res.send(rows);
    } catch (err) {
        console.log(err);
        res.status(400).send({ error: "Something went wrong." });
    }
});



// Helper function to check if the user is an admin
async function isAdmin(token: string): Promise<boolean> {
  const decodedTokenData: any = await decodeJwt(token);
  return decodedTokenData && decodedTokenData.role === "admin" ? true : false;
}
export default router;
