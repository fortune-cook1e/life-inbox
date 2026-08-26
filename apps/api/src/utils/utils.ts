export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).format();

    return true;
  } catch {
    return false;
  }
}

export function normalizeLocalDateTime(value: string | null): string | null {
  return value?.replace(" ", "T") ?? null;
}
