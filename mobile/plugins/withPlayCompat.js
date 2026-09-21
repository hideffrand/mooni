const {
  withAndroidManifest,
} = require("expo/config-plugins");

const REMOVE_PERMISSIONS = [
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.SYSTEM_ALERT_WINDOW",
];

const TOOLS_NS = "http://schemas.android.com/tools";

module.exports = function withPlayCompatibility(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    if (!manifest.manifest) return config;

    const attrs = manifest.manifest.$ || (manifest.manifest.$ = {});
    if (!attrs["xmlns:tools"]) {
      attrs["xmlns:tools"] = TOOLS_NS;
    }

    const application = manifest.manifest.application;
    if (Array.isArray(application) && application[0]) {
      const appAttrs = application[0].$ || (application[0].$ = {});
      appAttrs["android:allowBackup"] = "false";
    }

    const usesPermission = manifest.manifest["uses-permission"] || [];
    const existingNames = new Set(
      usesPermission
        .filter((p) => p.$ && p.$["tools:node"] === "remove")
        .map((p) => p.$["android:name"])
    );

    for (const name of REMOVE_PERMISSIONS) {
      if (!existingNames.has(name)) {
        usesPermission.push({
          $: { "android:name": name, "tools:node": "remove" },
        });
      }
    }
    manifest.manifest["uses-permission"] = usesPermission;
    return config;
  });

  return config;
};
