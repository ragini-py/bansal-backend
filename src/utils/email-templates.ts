/**
 * Luxury HTML email templates for Bansal-nx.
 * Fully responsive, table-based layouts with inline CSS compatible with all major email clients.
 */

interface VerificationEmailParams {
  name: string;
  verificationUrl: string;
  expiresHours?: number;
}

interface PasswordResetEmailParams {
  name: string;
  resetUrl: string;
  expiresMinutes?: number;
}

interface ContactEmailParams {
  name: string;
  email: string;
  subject: string;
  message: string;
}

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

function baseEmailLayout({
  previewText,
  title,
  contentHtml,
}: {
  previewText: string;
  title: string;
  contentHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f7f6f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .fluid { max-width: 100% !important; height: auto !important; margin-left: auto !important; margin-right: auto !important; }
      .stack-column, .stack-column-center { display: block !important; width: 100% !important; max-width: 100% !important; direction: ltr !important; }
      .stack-column-center { text-align: center !important; }
      .content-padding { padding: 24px 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f6f2; -webkit-font-smoothing: antialiased;">
  <!-- Hidden Preheader Text -->
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
    ${escapeHtml(previewText)}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f6f2; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 30px 12px;">
        <!-- Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e7e2d8;">
          
          <!-- Header Banner -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #112c2e 0%, #1a4244 100%); background-color: #112c2e; padding: 36px 20px 30px 20px; text-align: center; border-bottom: 3px solid #c6903c;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <span style="font-family: 'Cinzel', Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: 700; letter-spacing: 4px; color: #ffffff; text-transform: uppercase; display: block;">
                      BANSAL<span style="color: #c6903c;">·</span>NX
                    </span>
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; letter-spacing: 2.5px; color: #e4caa1; text-transform: uppercase; margin-top: 6px; display: block;">
                      Heritage & Modern Elegance
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="content-padding" style="padding: 40px 36px; background-color: #ffffff;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 30px; background-color: #fbfaf7; border-top: 1px solid #eeebe3; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <span style="font-family: 'Cinzel', Georgia, serif; font-size: 13px; font-weight: 600; letter-spacing: 1.5px; color: #112c2e; text-transform: uppercase;">
                      Bansal-nx Boutique
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 12px; line-height: 18px; color: #7a8487; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding-bottom: 12px;">
                    Kolkata, West Bengal, India<br>
                    Need assistance? Contact our concierge at <a href="mailto:care@bansalnx.com" style="color: #c6903c; text-decoration: none; font-weight: 500;">care@bansalnx.com</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 11px; line-height: 16px; color: #a2abae; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    &copy; ${new Date().getFullYear()} Bansal-nx. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates an email verification HTML template.
 */
export function renderEmailVerificationHtml({
  name,
  verificationUrl,
  expiresHours = 24,
}: VerificationEmailParams): string {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verificationUrl);

  const contentHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 20px;">
          <h1 style="margin: 0; font-family: 'Cinzel', Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #112c2e; letter-spacing: 0.5px; line-height: 30px;">
            Verify Your Email Address
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom: 18px; font-size: 15px; line-height: 24px; color: #3b4548;">
          Dear <strong>${safeName}</strong>,
        </td>
      </tr>
      <tr>
        <td style="padding-bottom: 24px; font-size: 15px; line-height: 24px; color: #4e595c;">
          Thank you for joining <strong>Bansal-nx</strong>. To activate your royal account and access your personal wardrobe, order tracking, and exclusive previews, please confirm your email address below:
        </td>
      </tr>

      <!-- CTA Button -->
      <tr>
        <td align="center" style="padding: 10px 0 28px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 4px; background: linear-gradient(135deg, #c6903c 0%, #b37e2d 100%); background-color: #c6903c; box-shadow: 0 4px 12px rgba(198, 144, 60, 0.35);">
                <a href="${safeUrl}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; padding: 15px 36px; display: inline-block; border-radius: 4px; border: 1px solid #d4a76a;">
                  Verify Email &amp; Continue &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Info Box -->
      <tr>
        <td style="padding: 18px 20px; background-color: #fbf9f4; border-left: 3px solid #c6903c; border-radius: 0 4px 4px 0; margin-bottom: 20px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #112c2e;">
            Direct Login Benefit:
          </p>
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: #616e72;">
            Clicking the link will verify your account and immediately sign you in to your Bansal-nx customer dashboard.
          </p>
        </td>
      </tr>

      <!-- Expiration Note -->
      <tr>
        <td style="padding-top: 24px; font-size: 13px; line-height: 20px; color: #7a8487;">
          This verification link will expire in <strong>${expiresHours} hours</strong>. If you did not create an account on Bansal-nx, please ignore this email.
        </td>
      </tr>

      <!-- Fallback Link -->
      <tr>
        <td style="padding-top: 20px; border-top: 1px solid #eeebe3; font-size: 12px; line-height: 18px; color: #949ea1; word-break: break-all;">
          If the button above does not work, copy and paste this URL into your browser:<br>
          <a href="${safeUrl}" style="color: #c6903c; text-decoration: underline;">${safeUrl}</a>
        </td>
      </tr>
    </table>
  `;

  return baseEmailLayout({
    previewText: "Verify your email address to access your Bansal-nx account.",
    title: "Verify your Bansal-nx email",
    contentHtml,
  });
}

/**
 * Generates a password reset HTML template.
 */
export function renderPasswordResetHtml({
  name,
  resetUrl,
  expiresMinutes = 30,
}: PasswordResetEmailParams): string {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);

  const contentHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 20px;">
          <h1 style="margin: 0; font-family: 'Cinzel', Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #112c2e; letter-spacing: 0.5px; line-height: 30px;">
            Reset Your Password
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom: 18px; font-size: 15px; line-height: 24px; color: #3b4548;">
          Dear <strong>${safeName}</strong>,
        </td>
      </tr>
      <tr>
        <td style="padding-bottom: 24px; font-size: 15px; line-height: 24px; color: #4e595c;">
          We received a request to reset your password for your <strong>Bansal-nx</strong> account. Click the button below to choose a new, secure password:
        </td>
      </tr>

      <!-- CTA Button -->
      <tr>
        <td align="center" style="padding: 10px 0 28px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 4px; background: linear-gradient(135deg, #112c2e 0%, #1a4244 100%); background-color: #112c2e; box-shadow: 0 4px 12px rgba(17, 44, 46, 0.35);">
                <a href="${safeUrl}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; padding: 15px 36px; display: inline-block; border-radius: 4px; border: 1px solid #c6903c;">
                  Reset Password &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Expiration Note -->
      <tr>
        <td style="padding-top: 10px; font-size: 13px; line-height: 20px; color: #7a8487;">
          This link will expire in <strong>${expiresMinutes} minutes</strong>. If you did not request a password reset, you can safely disregard this email—your account remains secure.
        </td>
      </tr>

      <!-- Fallback Link -->
      <tr>
        <td style="padding-top: 20px; border-top: 1px solid #eeebe3; font-size: 12px; line-height: 18px; color: #949ea1; word-break: break-all;">
          If the button above does not work, copy and paste this URL into your browser:<br>
          <a href="${safeUrl}" style="color: #c6903c; text-decoration: underline;">${safeUrl}</a>
        </td>
      </tr>
    </table>
  `;

  return baseEmailLayout({
    previewText: "Reset your Bansal-nx password.",
    title: "Reset your Bansal-nx password",
    contentHtml,
  });
}

/**
 * Generates a contact form submission notification HTML template.
 */
export function renderContactFormHtml({
  name,
  email,
  subject,
  message,
}: ContactEmailParams): string {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br>");

  const contentHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 20px;">
          <h1 style="margin: 0; font-family: 'Cinzel', Georgia, serif; font-size: 20px; font-weight: 700; color: #112c2e; line-height: 28px;">
            New Website Inquiry
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px; background-color: #fbf9f4; border-radius: 6px; border: 1px solid #eae5dc; margin-bottom: 20px;">
          <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 14px; color: #3b4548;">
            <tr>
              <td width="100" style="font-weight: 600; color: #112c2e;">From:</td>
              <td>${safeName} &lt;<a href="mailto:${safeEmail}" style="color: #c6903c; text-decoration: none;">${safeEmail}</a>&gt;</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #112c2e;">Subject:</td>
              <td>${safeSubject}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 16px; font-size: 15px; line-height: 24px; color: #2d373a;">
          <strong style="color: #112c2e; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Message:</strong>
          <div style="background-color: #ffffff; padding: 16px; border-left: 3px solid #112c2e; border: 1px solid #e7e2d8; border-left-width: 3px; border-radius: 4px; font-size: 14px; line-height: 22px;">
            ${safeMessage}
          </div>
        </td>
      </tr>
    </table>
  `;

  return baseEmailLayout({
    previewText: `New contact inquiry from ${safeName}: ${safeSubject}`,
    title: `Website Inquiry: ${safeSubject}`,
    contentHtml,
  });
}
