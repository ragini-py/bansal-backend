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

export interface OrderEmailData {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  lines: Array<{
    name: string;
    size: string;
    colour: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  status: string;
  payment: {
    method: string;
    status: string;
    amount: number;
  };
  address: {
    fullName?: string;
    phone?: string;
    line1?: string;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  shipment?: {
    courier?: string | null;
    awb?: string | null;
    trackingUrl?: string | null;
    estimatedDelivery?: Date | string | null;
  };
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: "Order Confirmed",
  processing: "Processing in Jaipur Atelier",
  packed: "Packed in Regal Box",
  ready_for_pickup: "Ready for Courier Collection",
  shipped: "Dispatched",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery Today",
  delivered: "Delivered",
  cancelled: "Cancelled",
  delivery_failed: "Delivery Failed",
  ndr: "Delivery Attempt Exception",
  rto: "Returned to Origin",
  lost: "Lost / Carrier Exception",
};

function formatOrderLinesHtml(lines: OrderEmailData["lines"]): string {
  const rows = lines
    .map(
      (line) => `
    <tr style="border-bottom: 1px solid #eeebe3; font-size: 13px;">
      <td style="padding: 12px 8px; color: #112c2e; font-weight: 500;">
        ${escapeHtml(line.name)}
      </td>
      <td style="padding: 12px 8px; color: #5f6d70; text-align: center;">
        ${escapeHtml(line.size)} · ${escapeHtml(line.colour)}
      </td>
      <td style="padding: 12px 8px; color: #5f6d70; text-align: center;">
        ${line.quantity}
      </td>
      <td style="padding: 12px 8px; color: #112c2e; text-align: right; font-weight: 600;">
        &#8377;${(line.price * line.quantity).toLocaleString("en-IN")}
      </td>
    </tr>
  `,
    )
    .join("");

  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-top: 14px;">
      <thead>
        <tr style="background-color: #f7f4ee; border-bottom: 2px solid #e5dac6; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8a6a3b;">
          <th style="padding: 10px 8px; text-align: left;">Item</th>
          <th style="padding: 10px 8px; text-align: center;">Variant</th>
          <th style="padding: 10px 8px; text-align: center;">Qty</th>
          <th style="padding: 10px 8px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function formatAddressHtml(addr: OrderEmailData["address"]): string {
  const parts = [
    addr.fullName,
    addr.line1,
    addr.locality,
    [addr.city, addr.state, addr.pincode].filter(Boolean).join(" "),
    addr.country,
    addr.phone ? `Phone: ${addr.phone}` : null,
  ].filter(Boolean);

  return parts.map((p) => escapeHtml(String(p))).join("<br>");
}

// ---------------------------------------------------------------------------
// 1. Customer: Order Confirmed
// ---------------------------------------------------------------------------
export function renderCustomerOrderConfirmedEmail({
  order,
  trackingUrl,
}: {
  order: OrderEmailData;
  trackingUrl: string;
}): { html: string; text: string; subject: string } {
  const safeName = escapeHtml(order.customerName);
  const safeId = escapeHtml(order.id);
  const safeTrackUrl = escapeHtml(trackingUrl);

  const linesHtml = formatOrderLinesHtml(order.lines);
  const addressHtml = formatAddressHtml(order.address);

  const contentHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #c6903c; display: block;">
            Order Confirmation
          </span>
          <h1 style="margin: 4px 0 0 0; font-family: 'Cinzel', Georgia, serif; font-size: 24px; font-weight: 700; color: #112c2e; line-height: 32px;">
            Thank you for your order
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0 20px 0; font-size: 15px; line-height: 24px; color: #4e595c;">
          Dear <strong>${safeName}</strong>,<br>
          We have received your bespoke order <strong>#${safeId}</strong>. Our Jaipur artisans and master tailors have begun preparing your pieces with the utmost attention to detail.
        </td>
      </tr>

      <!-- Order Summary Card -->
      <tr>
        <td style="padding: 16px; background-color: #fcfbf9; border-radius: 8px; border: 1px solid #eae5db; margin-bottom: 24px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="font-size: 13px; color: #727f82;">Order Number:</td>
              <td style="font-size: 13px; font-weight: 700; color: #112c2e; text-align: right;">#${safeId}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #727f82; padding-top: 6px;">Payment Method:</td>
              <td style="font-size: 13px; font-weight: 600; color: #112c2e; text-align: right; padding-top: 6px; text-transform: uppercase;">
                ${escapeHtml(order.payment.method === "cod" ? "Cash on Delivery" : "Razorpay Online")}
              </td>
            </tr>
          </table>

          ${linesHtml}

          <!-- Financial Breakdown -->
          <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 13px; color: #4e595c; margin-top: 14px; border-top: 1px solid #e7e2d8; padding-top: 10px;">
            <tr>
              <td>Subtotal</td>
              <td style="text-align: right;">&#8377;${order.subtotal.toLocaleString("en-IN")}</td>
            </tr>
            ${
              order.discount > 0
                ? `<tr>
                    <td style="color: #c6903c;">Savings &amp; Discount</td>
                    <td style="text-align: right; color: #c6903c;">-&#8377;${order.discount.toLocaleString("en-IN")}</td>
                  </tr>`
                : ""
            }
            <tr>
              <td>Shipping</td>
              <td style="text-align: right;">
                ${order.shippingFee === 0 ? "Complimentary" : `&#8377;${order.shippingFee.toLocaleString("en-IN")}`}
              </td>
            </tr>
            <tr style="font-size: 16px; font-weight: 700; color: #112c2e; border-top: 2px solid #c6903c;">
              <td style="padding-top: 10px;">Total Paid / Payable</td>
              <td style="text-align: right; padding-top: 10px; color: #c6903c;">&#8377;${order.total.toLocaleString("en-IN")}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Shipping Destination -->
      <tr>
        <td style="padding: 16px 0; font-size: 13px; line-height: 20px; color: #4e595c;">
          <strong style="color: #112c2e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">
            Delivery Destination:
          </strong>
          ${addressHtml}
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td align="center" style="padding: 20px 0 16px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 4px; background: linear-gradient(135deg, #112c2e 0%, #1a4244 100%); background-color: #112c2e;">
                <a href="${safeTrackUrl}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; padding: 14px 34px; display: inline-block; border-radius: 4px; border: 1px solid #c6903c;">
                  Track Order Online &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = baseEmailLayout({
    previewText: `Your Bansal-nx order #${order.id} is confirmed! Total: ₹${order.total.toLocaleString("en-IN")}.`,
    title: `Order Confirmation #${order.id}`,
    contentHtml,
  });

  const textLines = order.lines
    .map((l) => `  - ${l.quantity}x ${l.name} (${l.size}, ${l.colour}) - Rs. ${(l.price * l.quantity).toLocaleString("en-IN")}`)
    .join("\n");

  const text = `Hi ${order.customerName},

Thank you for your order with Bansal-nx!

Order #${order.id}
Payment: ${order.payment.method === "cod" ? "Cash on Delivery" : "Razorpay Online"}
Subtotal: Rs. ${order.subtotal.toLocaleString("en-IN")}
Discount: Rs. ${order.discount.toLocaleString("en-IN")}
Shipping: ${order.shippingFee === 0 ? "Complimentary" : `Rs. ${order.shippingFee}`}
Total: Rs. ${order.total.toLocaleString("en-IN")}

Items Ordered:
${textLines}

Delivery Address:
${order.address.fullName || order.customerName}
${order.address.line1 || ""}
${order.address.locality || ""}
${order.address.city || ""} ${order.address.state || ""} ${order.address.pincode || ""}
Phone: ${order.address.phone || order.phone}

Track your order anytime at:
${trackingUrl}

With warm regards,
Bansal-nx Boutique`;

  return { html, text, subject: `Your Bansal-nx Order #${order.id} is confirmed` };
}

// ---------------------------------------------------------------------------
// 2. Admin: New Order Alert
// ---------------------------------------------------------------------------
export function renderAdminNewOrderAlertEmail({
  order,
  adminOrderUrl,
}: {
  order: OrderEmailData;
  adminOrderUrl: string;
}): { html: string; text: string; subject: string } {
  const safeName = escapeHtml(order.customerName);
  const safeId = escapeHtml(order.id);
  const safeAdminUrl = escapeHtml(adminOrderUrl);

  const linesHtml = formatOrderLinesHtml(order.lines);
  const addressHtml = formatAddressHtml(order.address);

  const contentHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #b33939; display: block;">
            Store Alert &bull; New Order Received
          </span>
          <h1 style="margin: 4px 0 0 0; font-family: 'Cinzel', Georgia, serif; font-size: 22px; font-weight: 700; color: #112c2e; line-height: 30px;">
            New Order #${safeId} (&#8377;${order.total.toLocaleString("en-IN")})
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0 18px 0; font-size: 14px; line-height: 22px; color: #4e595c;">
          A customer just placed a new order on the Bansal-nx storefront.
        </td>
      </tr>

      <!-- Key Stats -->
      <tr>
        <td style="padding: 14px 18px; background-color: #f7f9f9; border-left: 4px solid #112c2e; border-radius: 4px; margin-bottom: 18px;">
          <table border="0" cellpadding="3" cellspacing="0" width="100%" style="font-size: 13px; color: #3b4548;">
            <tr>
              <td width="130" style="font-weight: 600; color: #112c2e;">Customer Name:</td>
              <td>${safeName}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #112c2e;">Email:</td>
              <td><a href="mailto:${escapeHtml(order.email)}" style="color: #c6903c; text-decoration: none;">${escapeHtml(order.email)}</a></td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #112c2e;">Phone:</td>
              <td>${escapeHtml(order.phone || order.address.phone || "N/A")}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #112c2e;">Payment Mode:</td>
              <td><strong>${escapeHtml(order.payment.method.toUpperCase())}</strong> (${escapeHtml(order.payment.status)})</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Items Table -->
      <tr>
        <td style="padding-top: 10px;">
          ${linesHtml}
        </td>
      </tr>

      <!-- Shipping Address -->
      <tr>
        <td style="padding: 16px 0; font-size: 13px; line-height: 20px; color: #4e595c;">
          <strong style="color: #112c2e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">
            Shipping Address:
          </strong>
          ${addressHtml}
        </td>
      </tr>

      <!-- Admin CTA -->
      <tr>
        <td align="center" style="padding: 18px 0 10px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 4px; background-color: #c6903c;">
                <a href="${safeAdminUrl}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; padding: 14px 34px; display: inline-block; border-radius: 4px;">
                  Open Order in Admin Portal &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = baseEmailLayout({
    previewText: `New order #${order.id} received from ${order.customerName} for ₹${order.total.toLocaleString("en-IN")}`,
    title: `New Order Alert #${order.id}`,
    contentHtml,
  });

  const text = `[ADMIN NOTIFICATION] New Order Received

Order ID: #${order.id}
Customer: ${order.customerName} (${order.email}, ${order.phone || order.address.phone || ""})
Total: Rs. ${order.total.toLocaleString("en-IN")}
Payment: ${order.payment.method} (${order.payment.status})
Items: ${order.lines.length} lines

Manage Order in Admin Portal:
${adminOrderUrl}`;

  return {
    html,
    text,
    subject: `[NEW ORDER] #${order.id} - ₹${order.total.toLocaleString("en-IN")} from ${order.customerName}`,
  };
}

// ---------------------------------------------------------------------------
// 3. Customer: Order Status Update
// ---------------------------------------------------------------------------
export function renderCustomerOrderStatusUpdateEmail({
  order,
  oldStatus,
  newStatus,
  trackingUrl,
}: {
  order: OrderEmailData;
  oldStatus?: string;
  newStatus: string;
  trackingUrl: string;
}): { html: string; text: string; subject: string } {
  void oldStatus;
  const safeName = escapeHtml(order.customerName);
  const safeId = escapeHtml(order.id);
  const safeTrackUrl = escapeHtml(trackingUrl);
  const newStatusLabel = ORDER_STATUS_LABELS[newStatus] || newStatus;

  // Status-specific customer advice
  let statusBannerColor = "#112c2e";
  let statusMessage = "Your order status has been updated.";

  if (newStatus === "shipped" || newStatus === "in_transit") {
    statusBannerColor = "#184244";
    statusMessage = `Exciting news! Your Bansal-nx order #${safeId} has been dispatched from Jaipur.`;
  } else if (newStatus === "out_for_delivery") {
    statusBannerColor = "#9b7038";
    statusMessage = `Your package is out for delivery with our courier and will arrive today!`;
  } else if (newStatus === "delivered") {
    statusBannerColor = "#1f5f3e";
    statusMessage = `Your Bansal-nx package has been successfully delivered. We hope you cherish your regal garments!`;
  } else if (newStatus === "packed") {
    statusBannerColor = "#112c2e";
    statusMessage = `Your garments have completed meticulous quality review and are now packed for courier collection.`;
  } else if (newStatus === "processing") {
    statusBannerColor = "#112c2e";
    statusMessage = `Our atelier is actively tailoring and preparing your bespoke pieces.`;
  }

  const trackingInfoHtml =
    order.shipment?.awb || order.shipment?.courier
      ? `
    <tr>
      <td style="padding: 16px; background-color: #f7f9f9; border-radius: 6px; border: 1px solid #e1e7e7; margin: 18px 0;">
        <table border="0" cellpadding="3" cellspacing="0" width="100%" style="font-size: 13px; color: #3b4548;">
          ${order.shipment.courier ? `<tr><td width="120" style="font-weight: 600; color: #112c2e;">Courier Partner:</td><td>${escapeHtml(order.shipment.courier)}</td></tr>` : ""}
          ${order.shipment.awb ? `<tr><td style="font-weight: 600; color: #112c2e;">Tracking AWB:</td><td style="font-family: monospace; font-weight: 700;">${escapeHtml(order.shipment.awb)}</td></tr>` : ""}
        </table>
      </td>
    </tr>
  `
      : "";

  const contentHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #c6903c; display: block;">
            Shipment &amp; Fulfilment Update
          </span>
          <h1 style="margin: 4px 0 0 0; font-family: 'Cinzel', Georgia, serif; font-size: 22px; font-weight: 700; color: #112c2e; line-height: 30px;">
            ${escapeHtml(newStatusLabel)}
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0 16px 0; font-size: 15px; line-height: 24px; color: #4e595c;">
          Dear <strong>${safeName}</strong>,<br>
          ${statusMessage}
        </td>
      </tr>

      ${trackingInfoHtml}

      <!-- Order Details Summary -->
      <tr>
        <td style="padding: 16px; background-color: #fcfbf9; border-radius: 8px; border: 1px solid #eae5db; margin: 16px 0;">
          <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #725b34;">
            Order #${safeId} &bull; Summary
          </p>
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: #4e595c;">
            ${order.lines.map((l) => `${l.quantity}x ${escapeHtml(l.name)} (${escapeHtml(l.size)})`).join(", ")}<br>
            <strong>Total: &#8377;${order.total.toLocaleString("en-IN")}</strong>
          </p>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td align="center" style="padding: 22px 0 14px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 4px; background-color: ${statusBannerColor};">
                <a href="${safeTrackUrl}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; padding: 14px 34px; display: inline-block; border-radius: 4px; border: 1px solid #c6903c;">
                  Track Live Package &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = baseEmailLayout({
    previewText: `Order #${order.id} update: ${newStatusLabel}.`,
    title: `Order Update #${order.id}: ${newStatusLabel}`,
    contentHtml,
  });

  const text = `Hi ${order.customerName},

Update regarding your Bansal-nx order #${order.id}:
Current Status: ${newStatusLabel}

${order.shipment?.courier ? `Courier: ${order.shipment.courier}\n` : ""}${order.shipment?.awb ? `AWB: ${order.shipment.awb}\n` : ""}
Track live shipment:
${trackingUrl}

Warm regards,
Bansal-nx Boutique`;

  return {
    html,
    text,
    subject: `Update on your Bansal-nx Order #${order.id}: ${newStatusLabel}`,
  };
}

// ---------------------------------------------------------------------------
// 4. Admin: Order Status Update Alert
// ---------------------------------------------------------------------------
export function renderAdminOrderStatusUpdateEmail({
  order,
  oldStatus,
  newStatus,
  actorName,
  adminOrderUrl,
}: {
  order: OrderEmailData;
  oldStatus: string;
  newStatus: string;
  actorName: string;
  adminOrderUrl: string;
}): { html: string; text: string; subject: string } {
  const safeId = escapeHtml(order.id);
  const safeCustomer = escapeHtml(order.customerName);
  const safeActor = escapeHtml(actorName);
  const oldLabel = ORDER_STATUS_LABELS[oldStatus] || oldStatus;
  const newLabel = ORDER_STATUS_LABELS[newStatus] || newStatus;

  const contentHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #112c2e; display: block;">
            Admin Fulfilment Log
          </span>
          <h1 style="margin: 4px 0 0 0; font-family: 'Cinzel', Georgia, serif; font-size: 20px; font-weight: 700; color: #112c2e; line-height: 28px;">
            Order #${safeId} Status Changed
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0 16px 0; font-size: 14px; line-height: 22px; color: #4e595c;">
          Order #${safeId} for customer <strong>${safeCustomer}</strong> was moved:
        </td>
      </tr>

      <tr>
        <td style="padding: 16px; background-color: #f7f9f9; border-radius: 6px; border: 1px solid #e1e7e7; margin: 12px 0;">
          <p style="margin: 0; font-size: 15px; font-weight: 600; color: #112c2e;">
            <span style="color: #727f82;">${escapeHtml(oldLabel)}</span> &rarr; <span style="color: #c6903c;">${escapeHtml(newLabel)}</span>
          </p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #727f82;">
            Updated by: <strong>${safeActor}</strong> &bull; Total: &#8377;${order.total.toLocaleString("en-IN")}
          </p>
          ${order.shipment?.awb ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #727f82;">Carrier AWB: <strong>${escapeHtml(order.shipment.awb)}</strong> (${escapeHtml(order.shipment.courier || "Standard")})</p>` : ""}
        </td>
      </tr>

      <tr>
        <td align="center" style="padding: 20px 0 10px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 4px; background-color: #112c2e;">
                <a href="${escapeHtml(adminOrderUrl)}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; padding: 12px 30px; display: inline-block; border-radius: 4px;">
                  View in Admin Portal &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = baseEmailLayout({
    previewText: `Order #${order.id} status changed to ${newLabel} by ${actorName}`,
    title: `Order Update #${order.id}`,
    contentHtml,
  });

  const text = `[ADMIN LOG] Order #${order.id} Status Updated
Customer: ${order.customerName}
Transition: ${oldLabel} -> ${newLabel}
Updated by: ${actorName}

Admin URL: ${adminOrderUrl}`;

  return {
    html,
    text,
    subject: `[ORDER UPDATE] #${order.id} moved to ${newLabel}`,
  };
}

// ---------------------------------------------------------------------------
// 5. Customer: Order Cancelled
// ---------------------------------------------------------------------------
export function renderCustomerOrderCancelledEmail({
  order,
  reason,
  trackingUrl,
}: {
  order: OrderEmailData;
  reason: string;
  trackingUrl: string;
}): { html: string; text: string; subject: string } {
  const safeName = escapeHtml(order.customerName);
  const safeId = escapeHtml(order.id);
  const safeReason = escapeHtml(reason || "Cancelled upon request");
  const isPrepaid = order.payment.status === "refunded" || order.payment.method !== "cod";

  const contentHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #c0392b; display: block;">
            Cancellation Advice
          </span>
          <h1 style="margin: 4px 0 0 0; font-family: 'Cinzel', Georgia, serif; font-size: 22px; font-weight: 700; color: #112c2e; line-height: 30px;">
            Order #${safeId} Cancelled
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0 16px 0; font-size: 15px; line-height: 24px; color: #4e595c;">
          Dear <strong>${safeName}</strong>,<br>
          As requested, your Bansal-nx order <strong>#${safeId}</strong> has been cancelled.
        </td>
      </tr>

      <!-- Cancellation Details Box -->
      <tr>
        <td style="padding: 16px; background-color: #fcfbf9; border-radius: 8px; border: 1px solid #eae5db; margin: 12px 0;">
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #727f82;">Reason for Cancellation:</p>
          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #112c2e;">${safeReason}</p>

          <div style="border-top: 1px solid #eeebe3; padding-top: 10px;">
            <p style="margin: 0; font-size: 13px; color: #3b4548;">
              ${
                isPrepaid
                  ? `<strong>Refund Status:</strong> 100% refund of <strong>&#8377;${order.total.toLocaleString("en-IN")}</strong> has been initiated back to your original payment method. Depending on your bank/card issuer, funds typically reflect within 5–7 business days.`
                  : `<strong>Cash on Delivery:</strong> No funds were collected. Zero cancellation charges have been incurred.`
              }
            </p>
          </div>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td align="center" style="padding: 22px 0 10px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 4px; background-color: #112c2e;">
                <a href="${escapeHtml(trackingUrl)}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; padding: 13px 32px; display: inline-block; border-radius: 4px;">
                  View Cancellation Receipt &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = baseEmailLayout({
    previewText: `Your Bansal-nx order #${order.id} has been cancelled.`,
    title: `Order Cancellation #${order.id}`,
    contentHtml,
  });

  const text = `Hi ${order.customerName},

Your Bansal-nx order #${order.id} has been cancelled.

Reason: ${reason}
${
  isPrepaid
    ? `Refund: Rs. ${order.total.toLocaleString("en-IN")} initiated to original payment source (5–7 business days).`
    : `Payment: Cash on Delivery — no charges incurred.`
}

View details:
${trackingUrl}

Warm regards,
Bansal-nx Boutique`;

  return { html, text, subject: `Cancellation Confirmed: Bansal-nx Order #${order.id}` };
}

// ---------------------------------------------------------------------------
// 6. Admin: Order Cancelled Alert
// ---------------------------------------------------------------------------
export function renderAdminOrderCancelledEmail({
  order,
  reason,
  actorName,
  adminOrderUrl,
}: {
  order: OrderEmailData;
  reason: string;
  actorName: string;
  adminOrderUrl: string;
}): { html: string; text: string; subject: string } {
  const safeId = escapeHtml(order.id);
  const safeCustomer = escapeHtml(order.customerName);
  const safeReason = escapeHtml(reason || "Cancelled");
  const safeActor = escapeHtml(actorName);

  const contentHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #c0392b; display: block;">
            Store Alert &bull; Order Cancelled
          </span>
          <h1 style="margin: 4px 0 0 0; font-family: 'Cinzel', Georgia, serif; font-size: 20px; font-weight: 700; color: #112c2e; line-height: 28px;">
            Order #${safeId} Cancelled (&#8377;${order.total.toLocaleString("en-IN")})
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0 16px 0; font-size: 14px; line-height: 22px; color: #4e595c;">
          Customer <strong>${safeCustomer}</strong>'s order has been marked cancelled.
        </td>
      </tr>

      <tr>
        <td style="padding: 16px; background-color: #fdf7f7; border-left: 4px solid #c0392b; border-radius: 4px; margin: 12px 0;">
          <p style="margin: 0; font-size: 13px; color: #3b4548;">
            <strong>Reason:</strong> ${safeReason}<br>
            <strong>Cancelled By:</strong> ${safeActor}<br>
            <strong>Payment Mode:</strong> ${escapeHtml(order.payment.method)} &bull; <strong>Total:</strong> &#8377;${order.total.toLocaleString("en-IN")}
          </p>
        </td>
      </tr>

      <tr>
        <td align="center" style="padding: 18px 0 10px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 4px; background-color: #112c2e;">
                <a href="${escapeHtml(adminOrderUrl)}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; padding: 12px 30px; display: inline-block; border-radius: 4px;">
                  Open in Admin Portal &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = baseEmailLayout({
    previewText: `Order #${order.id} cancelled. Reason: ${reason}.`,
    title: `Order Cancelled #${order.id}`,
    contentHtml,
  });

  const text = `[ADMIN ALERT] Order #${order.id} Cancelled
Customer: ${order.customerName}
Reason: ${reason}
Cancelled By: ${actorName}
Total: Rs. ${order.total.toLocaleString("en-IN")}

Admin Link:
${adminOrderUrl}`;

  return {
    html,
    text,
    subject: `[ORDER CANCELLED] #${order.id} - ₹${order.total.toLocaleString("en-IN")} (${order.customerName})`,
  };
}

