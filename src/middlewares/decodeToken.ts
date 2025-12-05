import jwt from "jsonwebtoken";
async function decodeJwt(token :string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  // Signature verification would require the secret/public key and a cryptographic library
  const data = await jwt.decode(token);
  // For demonstration purposes, only decoding header and payload is shown.

  // console.log(data);
  return  data;
}

export default decodeJwt;
