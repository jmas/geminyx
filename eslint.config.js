// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const { allExtensions } = require("eslint-config-expo/flat/utils/extensions.js");

module.exports = defineConfig([
  expoConfig,
  {
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
        node: {
          extensions: allExtensions,
        },
      },
    },
  },
  {
    ignores: ["dist/*"],
  },
]);
