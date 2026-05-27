import { randomBytes } from 'crypto';

/**
 * Generates a URL-friendly slug from a given string.
 * Handles special characters, accents, and appends a random suffix
 * to ensure uniqueness.
 *
 * @param text - The input string to slugify
 * @returns A URL-friendly slug with a random suffix
 *
 * @example
 * generateSlug('Café con Leche!') // => 'cafe-con-leche-a1b2c3'
 */
export function generateSlug(text: string): string {
  const slug = text
    .toString()
    .normalize('NFD')                   // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '')    // Remove diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')      // Remove non-alphanumeric characters
    .replace(/[\s_]+/g, '-')            // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-')               // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');          // Remove leading/trailing hyphens

  const suffix = randomBytes(3).toString('hex'); // 6-char random suffix

  return `${slug}-${suffix}`;
}
