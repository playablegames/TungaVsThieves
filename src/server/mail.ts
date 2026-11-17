// REPORTS BY EMAIL (2026-11-17, owner: "email them to business@playablegames.in"). The same Google Workspace mailbox
// Bale sends from. Needs on the host: SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), SMTP_USER (business@playablegames.in),
// SMTP_PASS (a Google app password), optional REPORTS_TO (default business@playablegames.in). Without them: no email,
// the report is still kept in the game's log.
import nodemailer from "nodemailer";

export async function mailReport(subject: string, text: string): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, REPORTS_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false;
  const port = Number(SMTP_PORT || 465);
  try {
    await nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, "") } })
      .sendMail({ from: { name: "Tunga vs Thieves", address: SMTP_USER }, to: REPORTS_TO || "business@playablegames.in", subject, text });
    return true;
  } catch (e) {
    console.error("report mail failed", (e as Error).message);
    return false;
  }
}
