/**
 * Email Client
 *
 * Resend client for sending transactional emails.
 * Used by the email processor webhook.
 */

import { Resend } from 'resend';

// Initialize Resend client
export const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Email configuration
 */
export const emailConfig = {
  from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
  replyTo: process.env.EMAIL_REPLY_TO || 'twopeaksstudio@proton.me',
} as const;
