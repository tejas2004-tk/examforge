import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER
    ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
    : undefined,
  requireTLS: false,
  tls: { rejectUnauthorized: false },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  // In dev without SMTP credentials configured, log the email.
  if (!env.SMTP_HOST) {
    logger.info(`[EMAIL-STUB] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
  } catch (err) {
    logger.error('Email send failed', err);
  }
}

export function verificationEmail(to: string, code: string): EmailOptions {
  return {
    to,
    subject: 'Verify your ExamForge account',
    html: `
      <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ExamForge</h2>
        <p>Please verify your email address by entering this code:</p>
        <h1 style="font-size: 32px; letter-spacing: 4px; color: #2563eb;">${code}</h1>
        <p>This code expires in 30 minutes.</p>
        <p>If you didn't create an account, you can ignore this email.</p>
      </body></html>
    `,
  };
}

export function passwordResetEmail(to: string, resetLink: string): EmailOptions {
  return {
    to,
    subject: 'Reset your ExamForge password',
    html: `
      <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>We received a request to reset your password. Click the link below to proceed:</p>
        <p><a href="${resetLink}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;">Reset Password</a></p>
        <p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
      </body></html>
    `,
  };
}

export function testAssignedEmail(to: string, testTitle: string): EmailOptions {
  return {
    to,
    subject: `Test assigned: ${testTitle}`,
    html: `
      <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Test Assigned</h2>
        <p>You have been assigned the test <strong>${testTitle}</strong>.</p>
        <p>Log in to ExamForge to view and start your test.</p>
      </body></html>
    `,
  };
}

export function resultPublishedEmail(to: string, testTitle: string, score: string): EmailOptions {
  return {
    to,
    subject: `Result published: ${testTitle}`,
    html: `
      <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Result Is Ready</h2>
        <p>Your result for <strong>${testTitle}</strong> has been published.</p>
        <p>Final score: <strong>${score}</strong></p>
        <p>Log in to ExamForge to view your detailed result.</p>
      </body></html>
    `,
  };
}