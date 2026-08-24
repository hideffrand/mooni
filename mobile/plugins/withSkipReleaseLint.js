const { withAppBuildGradle } = require("@expo/config-plugins");

// Skip Android's release lint ("lintVital") during EAS builds. It's a
// static-analysis pass over every dependency and one of the most
// memory-hungry Gradle tasks - it gets the daemon OOM-killed on
// low-RAM machines and adds nothing to an internal preview APK.
module.exports = function withSkipReleaseLint(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("checkReleaseBuilds false")) {
      config.modResults.contents = config.modResults.contents.replace(
        /android \{/,
        `android {\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }`
      );
    }
    return config;
  });
};
