/** Personal name — English letters, spaces, hyphen, apostrophe only. */
const ENGLISH_NAME_PATTERN = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

export function isValidEnglishName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && ENGLISH_NAME_PATTERN.test(trimmed);
}
