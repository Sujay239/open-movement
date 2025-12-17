import express, { Request, Response } from "express";
import xlsx from "xlsx";
import path from "path";
import fs from "fs";
import { pool } from "../db";

const router = express.Router();

// // --- HELPER FUNCTIONS ---

// // Convert Excel "Yes"/"No", "TRUE"/"FALSE", or 1/0 to Postgres Boolean
// const parseBoolean = (value: unknown): boolean => {
//   if (value === null || value === undefined) return false;
//   const str = String(value).trim().toLowerCase();
//   return str === "yes" || str === "true" || str === "1";
// };

// // Convert "Active"/"Inactive" or similar to enum status
// const parseStatus = (value: unknown): string => {
//   if (!value) return "ACTIVE";
//   return String(value).trim().toUpperCase();
// };

// // Ensure numbers are actually integers
// const parseIntSafe = (value: unknown): number => {
//   const parsed = parseInt(String(value), 10);
//   return isNaN(parsed) ? 0 : parsed;
// };

// // --- API ENDPOINT ---

// router.post("/import-teachers-root", async (req: Request, res: Response) => {
//   const client = await pool.connect();

//   try {
//     // 1. Locate file in ROOT directory
//     const fileName = "teachers_data.xlsx";
//     const filePath = path.join(__dirname, fileName);

//     // 2. Check existence
//     if (!fs.existsSync(filePath)) {
//       return res.status(404).json({
//         error: `File '${fileName}' not found in project root.`,
//       });
//     }

//     // 3. Read Excel
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(
//       workbook.Sheets[sheetName]
//     );

//     if (data.length === 0) {
//       return res.status(400).json({ error: "Excel sheet is empty" });
//     }

//     // 4. Start Transaction
//     await client.query("BEGIN");

//     let insertedCount = 0;
//     const errors: string[] = [];

//     // 5. Loop through data
//     for (const [index, row] of data.entries()) {
//       // Validation
//       if (!row["Teacher Code"] || !row["Full Name"] || !row["Email"]) {
//         errors.push(`Row ${index + 2}: Missing Code, Name, or Email`);
//         continue;
//       }

//       try {
//         const queryText = `
//             INSERT INTO teachers (
//               teacher_code,
//               full_name,
//               email,
//               phone,
//               cv_link,
//               current_job_title,
//               subjects,
//               highest_qualification,
//               current_country,
//               current_region,
//               visa_status,
//               notice_period,
//               will_move_sem1,
//               will_move_sem2,
//               years_experience,
//               preferred_regions,
//               is_visible_in_school_portal,
//               profile_status,
//               current_school_name,
//               bio
//             )
//             VALUES (
//               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
//               $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
//             )
//             ON CONFLICT (teacher_code) DO NOTHING
//             RETURNING teacher_code;
//           `;

//         const values = [
//           String(row["Teacher Code"]),
//           String(row["Full Name"]),
//           String(row["Email"]),
//           String(row["Phone"] ?? ""),
//           String(row["CV Link"] ?? ""),
//           String(row["Job Title"] ?? ""),
//           String(row["Subjects"] ?? ""),
//           String(row["Highest Qualification"] ?? ""),
//           String(row["Country"] ?? ""),
//           String(row["Region"] ?? ""),
//           String(row["Visa Status"] ?? ""),
//           String(row["Notice Period"] ?? ""),
//           parseBoolean(row["Will Move Sem 1"]),
//           parseBoolean(row["Will Move Sem 2"]),
//           parseIntSafe(row["Years Experience"]),
//           String(row["Preferred Regions"] ?? ""),
//           parseBoolean(row["Visible in Portal"]),
//           parseStatus(row["Profile Status"]),
//           String(row["Current School"] ?? ""),
//           String(row["Bio"] ?? ""),
//         ];

//         // 🔥 FIXED: no shadowing of Express `res`
//         const dbResult = await client.query(queryText, values);

//         if (dbResult.rowCount && dbResult.rowCount > 0) {
//           insertedCount++;
//         } else {
//           errors.push(
//             `Row ${index + 2}: Skipped (Duplicate Teacher Code: ${
//               row["Teacher Code"]
//             })`
//           );
//         }
//       } catch (err: any) {
//         errors.push(
//           `Row ${index + 2} (${row["Teacher Code"]}): ${err.message}`
//         );
//       }
//     }

//     // 6. Commit Transaction
//     await client.query("COMMIT");

//     return res.json({
//       success: true,
//       message: "Import complete",
//       total_rows_found: data.length,
//       successfully_inserted: insertedCount,
//       errors,
//     });
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Import Critical Error:", error);
//     return res.status(500).json({ error: "Internal Server Error" });
//   } finally {
//     client.release();
//   }
// });









// router.delete("/teachers", async (req: Request, res: Response) => {
//   try {
//     await pool.query('TRUNCATE TABLE teachers RESTART IDENTITY CASCADE');
//    return res.send("deleted sucessfulyy all data");
//   } catch (err) {
//     console.log(err);
//     res.send('not completed')
//   }
// });
// router.delete("/teachers", async (req: Request, res: Response) => {
//   try {
//     await pool.query('TRUNCATE TABLE schools RESTART IDENTITY CASCADE');
//    return res.send("deleted sucessfulyy all data");
//   } catch (err) {
//     console.log(err);
//     res.send('not completed')
//   }
// });

export default router;
