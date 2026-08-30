/**
 * Notion REST API response shapes, narrowed to the parts we read.
 *
 * Deliberately partial. Notion returns large objects and we only ever touch a
 * handful of fields; typing the whole surface would be churn every time they
 * ship a property type we never use.
 *
 * @module lib/notion/types
 */

/** A Notion rich-text run, as sent in a property value or a block. */
export interface NotionRichText {
  type: 'text';
  text: { content: string; link?: { url: string } | null };
}

/** Any block we send in a `children` array. Shape varies by block type. */
export type NotionBlock = Record<string, unknown>;

/** Property values keyed by property name, as sent to `POST /v1/pages`. */
export type NotionPropertyValues = Record<string, unknown>;

/**
 * Notion's auto-incrementing ID property, returned on a created page.
 *
 * `prefix` is configured on the property in Notion and may be null, in which
 * case the reference is just the number.
 */
export interface NotionUniqueId {
  type: 'unique_id';
  unique_id: { prefix: string | null; number: number };
}

/** The subset of `POST /v1/pages` we consume. */
export interface NotionPageResponse {
  id: string;
  url: string;
  properties: Record<string, unknown>;
}

/** The subset of `POST /v1/file_uploads` we consume. */
export interface NotionFileUploadResponse {
  id: string;
  /** Endpoint the raw bytes are POSTed to in step two. */
  upload_url: string;
}

/** Reference to an already-uploaded file, embeddable in an image block. */
export interface NotionFileUploadRef {
  /** Upload id from {@link NotionFileUploadResponse}. */
  id: string;
  /** Original filename, used as the image block's caption. */
  filename: string;
}
