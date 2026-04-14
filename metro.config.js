// Enable React Native Worklets "bundle mode" so custom worklet runtimes
// can execute bundled JS modules (and have Metro inject the worklet runtime entry).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Mirror `react-native-worklets/bundleMode` but compose with Expo's Metro defaults.
const workletsPackageDir = path.dirname(
  require.resolve("react-native-worklets/package.json"),
);
const nodeModulesDir = path.resolve(workletsPackageDir, "..");

const defaultsGetModulesRunBeforeMain =
  config.serializer?.getModulesRunBeforeMainModule?.bind(config.serializer) ??
  (() => []);
const defaultResolveRequest = config.resolver?.resolveRequest;

config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule(dirname) {
    return [
      require.resolve("react-native-worklets/src/workletRuntimeEntry.ts"),
      require.resolve("react-native-worklets/lib/module/workletRuntimeEntry.js"),
      ...defaultsGetModulesRunBeforeMain(dirname),
    ];
  },
  createModuleIdFactory() {
    let nextId = 0;
    const idFileMap = new Map();
    return (moduleName) => {
      if (idFileMap.has(moduleName)) {
        return idFileMap.get(moduleName);
      }
      if (moduleName.includes("react-native-worklets/__generatedWorklets/")) {
        const base = path.basename(moduleName, ".js");
        const id = Number(base);
        idFileMap.set(moduleName, id);
        return id;
      }
      idFileMap.set(moduleName, nextId++);
      return idFileMap.get(moduleName);
    };
  },
};

config.resolver = {
  ...config.resolver,
  resolveRequest(context, moduleName, platform) {
    if (moduleName.startsWith("react-native-worklets/__generatedWorklets/")) {
      const fullModuleName = path.join(nodeModulesDir, moduleName);
      return { type: "sourceFile", filePath: fullModuleName };
    }
    return defaultResolveRequest
      ? defaultResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;

