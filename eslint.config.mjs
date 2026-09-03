import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Physical-direction Tailwind utilities break RTL. Only logical ones are allowed:
 * ms-/me-/ps-/pe-/start-/end-/rounded-s/rounded-e/border-s/border-e/text-start/text-end.
 */
const physicalClassPattern =
  "(^|\\s|:)-?((ml|mr|pl|pr|left|right|rounded-[lr]|border-[lr]|scroll-m[lr]|scroll-p[lr])-|(text|float|clear)-(left|right)\\b)";

const rtlRule = {
  files: ["src/**/*.{ts,tsx}"],
  // Vendored shadcn primitives resolve direction at runtime (see sheet.tsx).
  ignores: ["src/components/ui/**"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: `Literal[value=/${physicalClassPattern}/]`,
        message:
          "Use logical Tailwind utilities (ms-, me-, ps-, pe-, start-, end-, text-start, rounded-s, border-e) so RTL works.",
      },
      {
        selector: `TemplateElement[value.raw=/${physicalClassPattern}/]`,
        message:
          "Use logical Tailwind utilities (ms-, me-, ps-, pe-, start-, end-, text-start, rounded-s, border-e) so RTL works.",
      },
    ],
  },
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  rtlRule,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/sw.js",
    ],
  },
];

export default eslintConfig;
