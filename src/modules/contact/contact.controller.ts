import { AppError } from "../../common/app-error.js";
import type { Request, Response } from "express";
import { getSettings } from "../settings/settings.service.js";
import { sendEmail } from "../../utils/email.js";
import { renderContactFormHtml } from "../../utils/email-templates.js";
import type { SubmitContactInput } from "./contact.schemas.js";

export async function submit(req: Request, res: Response): Promise<void> {
  const { name, email, subject, message } = req.body as SubmitContactInput;
  const settings = await getSettings();
  const delivered = await sendEmail(
    {
      to: settings.supportEmail,
      replyTo: email,
      subject: `Website contact form: ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
      html: renderContactFormHtml({ name, email, subject, message }),
    },
    { logFallback: false },
  );

  if (!delivered) {
    throw new AppError(503, "CONTACT_DELIVERY_UNAVAILABLE", "We couldn't deliver your message right now.");
  }

  res.status(202).json({ success: true });
}