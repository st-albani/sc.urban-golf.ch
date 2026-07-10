import nodemailer from 'nodemailer';

// Gemeinsamer Mail-Versand (Brevo/Nodemailer). Wird von Feedback- und
// Auth-Routen genutzt. Der Transporter wird lazy erzeugt, damit ENV-Vars
// zum Aufrufzeitpunkt gelesen werden.
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS,
      },
    });
  }
  return transporter;
}

/** Ist SMTP konfiguriert? Ohne Konfiguration wird nicht versendet. */
export function isMailConfigured() {
  return Boolean(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS);
}

/** Versendet eine Mail. Wirft bei Fehlern — Aufrufer entscheidet über Handling. */
export async function sendMail({ to, subject, text, html }) {
  return getTransporter().sendMail({
    from: '"Urban-Golf.ch - ScoreCard" <info@urban-golf.ch>',
    to,
    subject,
    text,
    html,
  });
}
