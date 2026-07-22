import nextConfig from "eslint-config-next/core-web-vitals";
import nextTypeScriptConfig from "eslint-config-next/typescript";

import baseConfig from "../../eslint.config.mjs";

const config = [...baseConfig, ...nextConfig, ...nextTypeScriptConfig];

export default config;
