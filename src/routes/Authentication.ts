import { Request, Response } from "express";
import { Router } from "express";
import { pool } from "../db";
import { encodePass } from "../middlewares/passwordEconder";
import { authenticateToken } from "../middlewares/authenticateToken";
import passwordMatcher from "../middlewares/passwordMatch";
import { generateToken } from "../middlewares/generateToken";
import decodeJwt from "../middlewares/decodeToken";
import { JwtPayload, TokenExpiredError } from "jsonwebtoken";
import { error } from "console";
import { sendMail } from "../utils/mailsender";

const router = Router();

//Register Users or schools
router.post("/register", async (req: Request, res: Response) => {
  const { name, contact_name, email, password, country, region } = req.body;
  try {
    const hash = await encodePass(password);
    if (!hash) {
      return res.status(403).send({ error: "password not hashed" });
    }
    await pool.query(
      `INSERT INTO schools (name ,contact_name, email , password_hash,country,region) VALUES ($1,$2,$3,$4,$5,$6)`,
      [name, contact_name, email, hash, country, region]
    );



    const { rows } = await pool.query(
      "SELECT * FROM schools WHERE email = $1 LIMIT 1",
      [email]
    );

    if (!rows || rows.length === 0) {
      return res
        .status(401)
        .send({
          error: `School not found associated with email: ${email} \n Please Register yourself first.`,
        });
    }

    const school = rows[0];

     await sendMail(
          email,
          "Verify your email address",
          `<p>Hi ${school.name},
    Welcome to Open Movement! Please verify your email address to complete your registration.
    Click the link below to confirm your email: http://localhost:5000/verifyemail/${school.verify_token}
    If you have any trouble with the link, please copy and paste it into your web browser's address bar.
    Thanks,
    The Open movement Team
    http://loclahost:5173 </p>` // or build nicer HTML
        );


    res.send({
      sucessMsg: "Registration sucessful. Email verification mail sent",
      name,
      email,
      hash,
    });
  } catch (err) {
    console.log(err);
    res
      .status(401)
      .send({ error: "Registration failed please try again "});
  }
});

//Login users or schools
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email
    const { rows } = await pool.query(
      "SELECT * FROM schools WHERE email = $1 LIMIT 1",
      [email]
    );

    if (!rows || rows.length === 0) {
      return res
        .status(401)
        .send({ error: `School not found associated with email: ${email} \n Please Register yourself first.` });
    }

    const school = rows[0];

    // 2. Compare password (bcrypt)
    const isMatch = await passwordMatcher(password, school.password_hash); // passwordMatcher uses bcrypt.compare

    if (!isMatch) {
      return res.status(401).send({ error: "Invalid password" });
    }

    if(!school.verified){
      return res.status(401).send({error : "Please verify your email first."});
    }

    // 3. Generate token
    const token = await generateToken(school.id ,school.name, school.email); // or user.id, etc.
    // const data = await decodeJwt(token);
    // console.log(data);

      res.cookie("token", token, {
        maxAge: 86400000, // 1 hour
        httpOnly: true, // cannot be accessed by JavaScript (more secure)
        secure: true, // only sent over HTTPS
        sameSite: "strict", // restricts cross-site usage
      });

    return res.send({ success: "Login successful", accessToken: token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).send({ error: "Error occurred in login." });
  }
});


router.get('/me' , authenticateToken , async (req : Request , res : Response) => {
  try{
    const token = req.cookies?.token;

    if(!token) {
      return res.status(400).send("No token provided.");
    }

    const data : any = await decodeJwt(token);

    const school = await pool.query('select * from schools where id = $1' , [data.id])

    if(!school) {
      return res.send(400).send({error : "Error in fetching school data"});
    }

    return res.send(school.rows[0]);

  }catch(err) {
    console.log(err);
    res.status(400).send({error : "Something went wrong."});
  }
});


router.post('/use-access-code', authenticateToken, async (req : Request , res : Response) => {
  try{
    const {code} = req.body;
    const token = req.cookies?.token;
    const school :any = await decodeJwt(token);

    await pool.query("BEGIN");

    const {rows} = await pool.query('select * from access_codes where code = $1' , [code]);
    const accessSchool = rows[0];

    if(accessSchool.status !== 'UNUSED'){
      return res.status(409).send({error : "Code is already used. please try with different code."});
    }

    if(accessSchool.school_id !== school.id){
      return res.status(401).send({error : "Please use the coreect code to access"});
    }

    await pool.query("update access_codes set first_used_at = NOW(), expires_at =  NOW() + INTERVAL '24 hours', status = 'ACTIVE' where code = $1", [code]);
    await pool.query("COMMIT");

    return res.send({success : "Your Trial preriod started for 24-hours"});


  }catch(err) {
    console.log(err);
    await pool.query("ROLLBACK");
    res.status(401).send("Something went wrong please try again.");
  }

});


export default router;
