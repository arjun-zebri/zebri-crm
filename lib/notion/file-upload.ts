/**
 * Notion File Upload API, the three-step dance.
 *
 * 1. `POST /v1/file_uploads` reserves an upload and returns an id plus a URL.
 * 2. `POST` the raw bytes to that URL as multipart.
 * 3. Reference `{ type: 'file_upload', file_upload: { id } }` from a block.
 *
 * Steps one and two live here; step three is a block, so it lives in
 * `lib/notion/blocks`. The upload must complete before the page is created,
 * because the image block needs the id at creation time.
 *
 * @module lib/notion/file-upload
 */
import { NotionApiError, notionApiKey, notionFetch, notionUpload } from './client';
import type { NotionFileUploadRef, NotionFileUploadResponse } from './types';

/** Image types we accept. Anything else is rejected before it reaches Notion. */
export const ALLOWED_SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Largest screenshot we relay. Comfortably above a full-page 4K PNG. */
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

/**
 * Uploads one image to Notion and returns the reference an image block needs.
 *
 * @throws {NotionApiError} if the file is rejected locally or by Notion.
 */
export async function uploadScreenshot(file: File): Promise<NotionFileUploadRef> {
  if (file.size > MAX_SCREENSHOT_BYTES) {
    throw new NotionApiError('Screenshot is larger than 5MB', 0, 'file_too_large');
  }
  if (!(ALLOWED_SCREENSHOT_TYPES as readonly string[]).includes(file.type)) {
    throw new NotionApiError(`Unsupported image type: ${file.type}`, 0, 'unsupported_type');
  }

  const apiKey = notionApiKey();
  const reserved = await notionFetch<NotionFileUploadResponse>(
    '/file_uploads',
    { filename: file.name, content_type: file.type },
    apiKey,
  );
  await notionUpload(reserved.upload_url, file, apiKey);
  return { id: reserved.id, filename: file.name };
}
