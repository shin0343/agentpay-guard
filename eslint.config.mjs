import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  // Standalone Node tooling (CommonJS on purpose; not bundled into the app).
  { files: ["scripts/**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
