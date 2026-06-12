'use server';

import nodemailer from 'nodemailer';

export interface SmtpTestConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_name?: string;
  from_email?: string;
}

export async function testSmtpConnection(
  cfg: SmtpTestConfig,
  toEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: cfg.smtp_port,
      secure: cfg.smtp_secure,
      auth: {
        user: cfg.smtp_user,
        pass: cfg.smtp_password,
      },
    });

    await transporter.verify();

    const fromName = cfg.from_name || 'SprintZeroPH IMS';
    const fromEmail = cfg.from_email || cfg.smtp_user;
    const from = `"${fromName}" <${fromEmail}>`;

    await transporter.sendMail({
      from,
      to: toEmail,
      subject: 'SMTP Test — SprintZeroPH IMS',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
          <h2 style="color:#0ea5e9;margin:0 0 16px;">✓ SMTP Test Successful</h2>
          <p style="color:#374151;">Your email settings are configured correctly.</p>
          <table style="margin-top:16px;font-size:13px;color:#6b7280;width:100%;">
            <tr><td style="padding:4px 0;"><strong>Host:</strong></td><td>${cfg.smtp_host}:${cfg.smtp_port}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Sender:</strong></td><td>${from}</td></tr>
          </table>
        </div>
      `,
    });

    return { success: true };
  } catch (err: any) {
    console.error('[SMTP TEST] Failed:', err?.message);
    return { success: false, error: err?.message || 'SMTP connection failed' };
  }
}
