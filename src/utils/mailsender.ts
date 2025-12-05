// src/utils/mailer.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // or your provider's SMTP host
  port: 587, // 465 for secure, 587 for TLS
  secure: false, // true for port 465, false for 587
  auth: {
    user: process.env.MAIL_USER, // your email
    pass: process.env.MAIL_PASS, // your email password / app password
  },
});

export async function sendMail(to: string, subject: string, html: string) {
  const info = await transporter.sendMail({
    from: `"My App" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });

  console.log("Message sent: %s", info.messageId);
  return info;
}
