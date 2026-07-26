import { config } from "dotenv";
import { resolve } from "node:path";

const apiDirectory = resolve(__dirname, "../..");
const workspaceDirectory = resolve(apiDirectory, "../..");
const environmentFile = resolve(workspaceDirectory, ".env");

let environmentLoaded = false;

export function loadEnvironment() {
  if (environmentLoaded) {
    return;
  }

  config({
    path: environmentFile,
    quiet: true,
  });

  environmentLoaded = true;
}
