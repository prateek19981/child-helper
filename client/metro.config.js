const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  buffer: require.resolve("buffer/"),
};

// Ship the bear mascot as a static asset (not a JS module).
if (!config.resolver.assetExts.includes("glb")) {
  config.resolver.assetExts.push("glb");
}
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== "glb");

// three's "exports" map omits the .js suffix GLTFLoader is imported with.
config.resolver.unstable_enablePackageExports = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three" || moduleName.startsWith("three/")) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
