export function formatLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;

  const [, year, month, day, hour, minute] = match;
  const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(calendarDate);

  return `${date}, ${hour}:${minute}`;
}

export function toApiDateTime(value: string) {
  if (!value) return null;
  return value.length === 16 ? `${value}:00` : value;
}

export function toFormDateTime(value: string | null) {
  return value?.slice(0, 19) ?? "";
}
