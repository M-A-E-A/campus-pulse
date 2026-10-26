import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Installed skill mirrors (canonical .agents/skills plus the copies other
    // tooling dirs hold) and taste-skill working files are not project code.
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
      "**/skills/**",
      "**/.taste-skill/**",
    ],
  },
];

export default eslintConfig;
