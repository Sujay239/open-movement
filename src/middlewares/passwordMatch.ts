import bcrypt from "bcrypt"
export default async function matchPassword(rawPass : string , hash : string) {
    return await bcrypt.compare(rawPass , hash);
}
