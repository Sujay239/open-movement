import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const key = process.env.JWT_SECRET;

export const generateToken = (
  id: number,
  name: string,
  email: string,
  role: string = "school"
): string => {
  if (!key) {
    throw new Error("JWT_SECRET is not configured in environment variables");
  }

  try {
    return jwt.sign({ id, name, email, role }, key, {
      expiresIn: "24h",
      algorithm: "HS256",
    });
  } catch (err) {
    console.error("Token generation error:", err);
    throw new Error("Failed to generate authentication token");
  }
};
