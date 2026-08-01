import { loadEnvironment } from "./environment.js";

export function getDefaultTimeZone() {
  loadEnvironment();

  return process.env.APP_TIME_ZONE?.trim() || "Europe/Stockholm";
}
