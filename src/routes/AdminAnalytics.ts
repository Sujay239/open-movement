import { Router, Request, Response } from "express";
import { pool } from "../db"; // Your DB connection
import { authenticateToken } from "../middlewares/authenticateToken";

const router = Router();

// Helper to get Postgres interval from query param
const getInterval = (range: string) => {
  switch (range) {
    case "24h":
      return "1 day";
    case "30d":
      return "30 days";
    case "90d":
      return "90 days";
    case "7d":
    default:
      return "7 days";
  }
};

router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "7d";
    const interval = getInterval(range);

    // --- 1. OVERVIEW STATS ---
    // We run multiple counts in parallel for speed
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM teacher_views WHERE viewed_at > NOW() - $1::INTERVAL) as views,
        (SELECT COUNT(*) FROM requests WHERE requested_at > NOW() - $1::INTERVAL) as requests,
        (SELECT COUNT(DISTINCT school_id) FROM teacher_views WHERE viewed_at > NOW() - $1::INTERVAL) as active_schools
    `;

    // --- 2. CHART DATA (Group by Day) ---
    // Postgres specific: generate_series ensures we have a row for every day, even if 0 views
    const chartQuery = `
      WITH dates AS (
          SELECT generate_series(
            DATE(NOW() - $1::INTERVAL),
            DATE(NOW()),
            '1 day'::interval
          )::date AS date
      )
      SELECT
        TO_CHAR(d.date, 'Dy') as name, -- Mon, Tue...
        TO_CHAR(d.date, 'YYYY-MM-DD') as full_date,
        COALESCE(v.count, 0) as views,
        COALESCE(r.count, 0) as requests
      FROM dates d
      LEFT JOIN (
        SELECT DATE(viewed_at) as day, COUNT(*) as count
        FROM teacher_views
        WHERE viewed_at > NOW() - $1::INTERVAL
        GROUP BY DATE(viewed_at)
      ) v ON d.date = v.day
      LEFT JOIN (
        SELECT DATE(requested_at) as day, COUNT(*) as count
        FROM requests
        WHERE requested_at > NOW() - $1::INTERVAL
        GROUP BY DATE(requested_at)
      ) r ON d.date = r.day
      ORDER BY d.date ASC;
    `;

    // --- 3. TOP SCHOOLS ---
    const schoolsQuery = `
      SELECT s.name, s.country as location, COUNT(v.id) as views
      FROM teacher_views v
      JOIN schools s ON v.school_id = s.id
      WHERE v.viewed_at > NOW() - $1::INTERVAL
      GROUP BY s.id
      ORDER BY views DESC
      LIMIT 5
    `;

    // --- 4. TOP TEACHERS ---
    const teachersQuery = `
      SELECT t.teacher_code as code, t.full_name as name, COUNT(v.id) as hits
      FROM teacher_views v
      JOIN teachers t ON v.teacher_id = t.id
      WHERE v.viewed_at > NOW() - $1::INTERVAL
      GROUP BY t.id
      ORDER BY hits DESC
      LIMIT 5
    `;

    // --- 5. REGION DATA ---
    const regionQuery = `
      SELECT
        COALESCE(s.region, s.country, 'Other') as name,
        COUNT(v.id) as value
      FROM teacher_views v
      JOIN schools s ON v.school_id = s.id
      WHERE v.viewed_at > NOW() - $1::INTERVAL
      GROUP BY 1
      ORDER BY value DESC
      LIMIT 5
    `;

    // EXECUTE ALL QUERIES
    const [statsRes, chartRes, schoolsRes, teachersRes, regionRes] =
      await Promise.all([
        pool.query(statsQuery, [interval]),
        pool.query(chartQuery, [interval]),
        pool.query(schoolsQuery, [interval]),
        pool.query(teachersQuery, [interval]),
        pool.query(regionQuery, [interval]),
      ]);

    // Format Stats
    const viewsCount = parseInt(statsRes.rows[0].views);
    const requestsCount = parseInt(statsRes.rows[0].requests);
    const activeSchoolsCount = parseInt(statsRes.rows[0].active_schools);
    const conversionRate =
      viewsCount > 0 ? ((requestsCount / viewsCount) * 100).toFixed(1) : 0;

    // Add Colors to Regions (Frontend expects specific colors)
    const regionColors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#64748b",
      "#8b5cf6",
    ];
    const formattedRegions = regionRes.rows.map((r, i) => ({
      ...r,
      value: parseInt(r.value),
      color: regionColors[i % regionColors.length],
    }));

    // FINAL RESPONSE
    res.json({
      stats: {
        totalViews: viewsCount,
        requests: requestsCount,
        activeSchools: activeSchoolsCount,
        conversion: conversionRate,
      },
      chartData: chartRes.rows.map((r) => ({
        date: r.name, // "Mon"
        fullDate: r.full_date,
        views: parseInt(r.views),
        requests: parseInt(r.requests),
      })),
      topSchools: schoolsRes.rows.map((r) => ({
        ...r,
        views: parseInt(r.views),
      })),
      topTeachers: teachersRes.rows.map((r) => ({
        ...r,
        hits: parseInt(r.hits),
      })),
      regionData: formattedRegions,
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ error: "Server error fetching analytics" });
  }
});

export default router;
