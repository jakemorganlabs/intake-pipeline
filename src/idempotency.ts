import { createHash } from 'crypto';

export function deriveIdempotencyKey(
  providerSubmissionId: string | null | undefined,
  email: string,
  formId: string,
  submittedAt: string
): string {
  // Primary: provider's stable id
  if (providerSubmissionId && typeof providerSubmissionId === 'string') {
    return `sub:${providerSubmissionId}`;
  }
  // Fallback: derived hash of email + form + submittedAt
  const normalized = `${email.toLowerCase().trim()}|${formId}|${submittedAt}`;
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `drv:${hash}`;
}
