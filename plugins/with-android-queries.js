// Declares Android 11+ "package visibility" so Linking.canOpenURL / openURL can see the phone
// dialer, messaging app and maps app. Without these <queries> entries canOpenURL("tel:...")
// returns false on many phones, which showed "This dialer is not available on this device".
const { withAndroidManifest } = require("expo/config-plugins");

const INTENTS = [
  { action: "android.intent.action.DIAL", scheme: "tel" },
  { action: "android.intent.action.VIEW", scheme: "tel" },
  { action: "android.intent.action.SENDTO", scheme: "smsto" },
  { action: "android.intent.action.VIEW", scheme: "sms" },
  { action: "android.intent.action.VIEW", scheme: "geo" },
  { action: "android.intent.action.VIEW", scheme: "https" },
];

function hasIntent(queries, { action, scheme }) {
  return queries.some((query) =>
    (query.intent || []).some((intent) => {
      const actions = (intent.action || []).map((a) => a.$ && a.$["android:name"]);
      const schemes = (intent.data || []).map((d) => d.$ && d.$["android:scheme"]);
      return actions.includes(action) && schemes.includes(scheme);
    }),
  );
}

module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    if (!Array.isArray(manifest.queries)) manifest.queries = [];
    if (manifest.queries.length === 0) manifest.queries.push({});
    const target = manifest.queries[0];
    if (!Array.isArray(target.intent)) target.intent = [];

    for (const item of INTENTS) {
      if (hasIntent(manifest.queries, item)) continue;
      target.intent.push({
        action: [{ $: { "android:name": item.action } }],
        data: [{ $: { "android:scheme": item.scheme } }],
      });
    }
    return mod;
  });
};
