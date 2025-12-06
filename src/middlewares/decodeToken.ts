// decodeToken.ts
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET_IN_ENV"; // must be from .env in production

export interface AppJwtPayload extends JwtPayload {
  id: number; // school_id or admin_id
  role?: string; // optional
}

async function decodeJwt(token: string): Promise<AppJwtPayload> {
  return new Promise((resolve, reject) => {
    if (!token) {
      return reject(new Error("No token provided"));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return reject(err); // token expired, invalid signature, etc
      }

      resolve(decoded as AppJwtPayload);
    });
  });
}

export default decodeJwt;
