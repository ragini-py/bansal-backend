import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtp) return null;
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
}

// No SMTP configured yet (see .env.example) — logs the email instead of
// silently dropping it, so every flow that sends mail (password reset,
// order confirmation) is fully testable in dev with zero setup, and
// upgrades to real delivery the moment SMTP_* is filled in, no code changes.
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const client = getTransporter();
  if (!client || !env.smtp) {
    console.log(`[email] (SMTP not configured — logging instead) to=${input.to} subject="${input.subject}"`);
    console.log(input.text);
    return;
  }

  await client.sendMail({
    from: env.smtp.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
