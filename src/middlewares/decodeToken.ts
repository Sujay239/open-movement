import jwt, { JwtPayload } from "jsonwebtoken";

export interface AppJwtPayload extends JwtPayload {
  id: number;
  role?: string;
}

async function decodeJwt(token: string): Promise<AppJwtPayload> {
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  return new Promise((resolve, reject) => {
    if (!token) {
      return reject(new Error("No token provided"));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return reject(err);
      }
      resolve(decoded as AppJwtPayload);
    });
  });
}

export default decodeJwt;
