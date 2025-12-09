import bcrypt from "bcrypt";

export const encodePass = async (rawPass: string) => {
  try {
    const salt = await bcrypt.genSalt(12);
    const hashPass = await bcrypt.hash(rawPass, salt);
    return hashPass;
  } catch (err) {
    console.log("Error generating hash password please try again.");
    throw new Error("password encoding failed");
  }
};
