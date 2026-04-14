module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "babel-plugin-module-resolver",
        {
          root: ["."],
          alias: {
            app: "./app",
            components: "./components",
            lib: "./lib",
            modules: "./modules",
            screens: "./screens",
            utils: "./utils",
          },
          extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
        },
      ],
      // Must be listed last.
      "react-native-worklets/plugin",
    ],
  };
};
