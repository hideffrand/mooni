const { withGradleProperties } = require("@expo/config-plugins");

// Low-RAM local build support: cap Gradle's heap/metaspace and worker
// count so the build daemon doesn't get OOM-killed on machines with
// ~6 GB RAM. No-op effect-wise on beefier CI runners, just slower.
module.exports = function withGradleMemoryLimits(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    const set = (key, value) => {
      const i = props.findIndex((p) => p.type === "property" && p.key === key);
      if (i >= 0) props[i].value = value;
      else props.push({ type: "property", key, value });
    };
    set("org.gradle.jvmargs", "-Xmx1536m -XX:MaxMetaspaceSize=384m");
    set("org.gradle.workers.max", "2");
    return config;
  });
};
