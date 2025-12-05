import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();
const key: string | undefined = process.env.JWT_SECRET || undefined;
export const generateToken = (id:number ,name: string, email: string , role: string = "school") => {
  try {
    if (key === undefined) {
      return "JWT key is undefined please give a jwt secret key";
    }
    return jwt.sign({id, name, email, role }, key, {
      expiresIn: "24h",
      algorithm: "HS256",
    });
  } catch (err) {
    return "Error in generating access token";
  }
};
