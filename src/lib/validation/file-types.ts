/**
 * File Type Validation
 *
 * Allowlist-based file type validation for secure uploads.
 * Prevents malicious files (.exe, .html, .js) while supporting business needs.
 *
 * SECURITY NOTE: SVG files are allowed per business requirements (Figma exports)
 * but can contain scripts. Only upload SVGs from trusted sources.
 *
 * Usage:
 *   import { isAllowedFileType } from '@/lib/validation/file-types';
 *   if (!isAllowedFileType(file)) {
 *     toast.error('File type not allowed');
 *   }
 */

/**
 * Allowed MIME types (allowlist approach)
 * Only these file types can be uploaded
 */
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml', // SVG allowed for Figma files (contains risk - see security note)

  // Documents
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx

  // Text
  'text/plain',
  'text/csv',
  'text/markdown',

  // Archives
  'application/zip',
  'application/x-zip-compressed',

  // Video (for product managers)
  'video/mp4',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi

  // Audio (optional - uncomment if needed)
  // 'audio/mpeg', // .mp3
  // 'audio/wav',
  // 'audio/ogg',
] as const;

/**
 * Explicitly blocked MIME types (extra safety)
 * These should NEVER be allowed
 */
export const BLOCKED_MIME_TYPES = [
  'text/html', // HTML can execute scripts
  'application/javascript', // JS files
  'application/x-javascript',
  'text/javascript',
  'application/x-msdownload', // .exe
  'application/x-executable',
  'application/x-sh', // Shell scripts
  'application/x-csh',
  'application/x-python-code', // Python files
  'application/x-perl', // Perl scripts
  'application/x-php', // PHP files
] as const;

/**
 * Allowed file extensions (secondary check)
 */
export const ALLOWED_EXTENSIONS = [
  // Images
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',

  // Documents
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',

  // Text
  'txt',
  'csv',
  'md',

  // Archives
  'zip',

  // Video
  'mp4',
  'mov',
  'avi',

  // Audio (optional)
  // 'mp3',
  // 'wav',
  // 'ogg',
] as const;

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if file type is allowed
 *
 * Uses defense-in-depth approach:
 * 1. Check MIME type against allowlist
 * 2. Check file extension against allowlist
 * 3. Check MIME type against blocklist
 *
 * @param file - File to validate
 * @returns true if file type is allowed
 */
export function isAllowedFileType(file: File): boolean {
  // Check 1: MIME type must be in allowlist
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return false;
  }

  // Check 2: Extension must be in allowlist (defense in depth)
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension as typeof ALLOWED_EXTENSIONS[number])) {
    return false;
  }

  // Check 3: MIME type must NOT be in blocklist (extra safety)
  if (BLOCKED_MIME_TYPES.includes(file.type as typeof BLOCKED_MIME_TYPES[number])) {
    return false;
  }

  return true;
}

/**
 * Get user-friendly description of allowed file types
 */
export function getAllowedFileTypesDescription(): string {
  return 'Images (JPG, PNG, GIF, SVG), Documents (PDF, Word, Excel, PowerPoint), Videos (MP4, MOV), Text files, and ZIP archives';
}

/**
 * Get detailed error message for rejected file
 */
export function getFileRejectionReason(file: File): string {
  const extension = getFileExtension(file.name);

  // Check if explicitly blocked
  if (BLOCKED_MIME_TYPES.includes(file.type as typeof BLOCKED_MIME_TYPES[number])) {
    return `${extension.toUpperCase()} files are not allowed for security reasons.`;
  }

  // Generic rejection
  return `${extension.toUpperCase()} files are not supported. Allowed types: ${getAllowedFileTypesDescription()}`;
}

/**
 * Validate multiple files at once
 *
 * @param files - Array of files to validate
 * @returns Object with valid files and rejected files with reasons
 */
export function validateFiles(files: File[]): {
  valid: File[];
  rejected: Array<{ file: File; reason: string }>;
} {
  const valid: File[] = [];
  const rejected: Array<{ file: File; reason: string }> = [];

  for (const file of files) {
    if (isAllowedFileType(file)) {
      valid.push(file);
    } else {
      rejected.push({
        file,
        reason: getFileRejectionReason(file),
      });
    }
  }

  return { valid, rejected };
}
