// Backend timestamps come from Python's datetime.utcnow(), which is UTC but
// has no timezone marker attached (e.g. "2026-07-21T19:52:30.123456" instead
// of "...Z"). JavaScript's `new Date(...)` assumes a string with no timezone
// info is LOCAL time, not UTC -- so without this fix, every timestamp gets
// silently shifted by the browser's timezone offset, which is exactly what
// caused the "-200 minutes ago" bug.
export function parseBackendDate(str) {
  if (!str) return null;
  const hasTimezone = /Z$|[+-]\d\d:\d\d$/.test(str);
  return new Date(hasTimezone ? str : str + "Z");
}

// Formats elapsed time as e.g. "3h 12m ago" / "8m ago" / "just now".
export function timeAgo(dateStr) {
  const then = parseBackendDate(dateStr);
  if (!then) return "";
  const totalMinutes = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (totalMinutes < 1) return "just now";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m ago`;
  return `${hours}h ${minutes}m ago`;
}