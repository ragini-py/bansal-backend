import { AppError } from "../../common/app-error.js";
import type { Request, Response } from "express";
import { getSettings } from "../settings/settings.service.js";
import { sendEmail } from "../../utils/email.js";
import type { SubmitContactInput } from "./contact.schemas.js";

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };
        return entities[character];
    });
}

export async function submit(req: Request, res: Response): Promise<void> {
    const { name, email, subject, message } = req.body as SubmitContactInput;
    const settings = await getSettings();
    const delivered = await sendEmail(
        {
            to: settings.supportEmail,
            replyTo: email,
            subject: `Website contact form: ${subject}`,
            text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
            html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Subject:</strong> ${escapeHtml(subject)}</p><p>${escapeHtml(message).replace(/\r?\n/g, "<br>")}</p>`,
        },
        { logFallback: false },
    );

    if (!delivered) {
        throw new AppError(503, "CONTACT_DELIVERY_UNAVAILABLE", "We couldn't deliver your message right now.");
    }

    res.status(202).json({ success: true });
}