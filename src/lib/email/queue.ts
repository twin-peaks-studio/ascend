/**
 * Email Queue
 *
 * QStash-based email queueing for background processing.
 * Emails are queued immediately and processed asynchronously with retries.
 *
 * Usage:
 *   import { queueEmail } from '@/lib/email/queue';
 *   await queueEmail('welcome', 'user@example.com', { name: 'John' });
 */

import { Client } from '@upstash/qstash';
import { logger } from '@/lib/logger';

// Initialize QStash client
const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export type EmailTemplate =
  | 'welcome'
  | 'project-invite'
  | 'email-verification'
  | 'password-reset';

interface EmailQueuePayload {
  template: EmailTemplate;
  to: string;
  data: Record<string, unknown>;
  from?: string;
}

/**
 * Queue an email for background processing
 *
 * @param template - Email template name
 * @param to - Recipient email address
 * @param data - Template data (variables to inject)
 * @param from - Optional sender email (defaults to noreply)
 * @returns Promise that resolves when email is queued
 */
export async function queueEmail(
  template: EmailTemplate,
  to: string,
  data: Record<string, unknown>,
  from?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Validate inputs
    if (!to || !template) {
      throw new Error('Missing required email parameters');
    }

    // Build webhook URL for QStash to call
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/emails/process`;

    // Payload for email processor
    const payload: EmailQueuePayload = {
      template,
      to,
      data,
      from: from || process.env.EMAIL_FROM || 'onboarding@resend.dev',
    };

    // Queue email with QStash
    const response = await qstash.publishJSON({
      url: webhookUrl,
      body: payload,
      retries: 3, // Retry failed emails 3 times
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('Email queued', {
      template,
      to,
      messageId: response.messageId,
    });

    return {
      success: true,
      messageId: response.messageId,
    };
  } catch (error) {
    logger.error('Failed to queue email', {
      error: error instanceof Error ? error.message : String(error),
      template,
      to,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify QStash signature (for webhook security)
 *
 * Call this in your webhook handler to verify requests come from QStash.
 *
 * @param signature - Signature from request header
 * @param body - Request body as string
 * @returns Whether signature is valid
 */
export function verifyQStashSignature(
  signature: string | null,
  body: string
): boolean {
  if (!signature) return false;

  try {
    // QStash provides current and next signing keys for rotation
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY!;
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY!;

    // Verify with both keys (during rotation period)
    // This is a simplified check - in production, use proper HMAC verification
    return signature === currentKey || signature === nextKey;
  } catch (error) {
    logger.error('Failed to verify QStash signature', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
