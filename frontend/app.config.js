// Adds to app.json. A TEST build (ALLOW_CLEARTEXT=1) may talk to a plain http:// backend on your own network;
// a production build never allows that, so it can only use https://.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    ...(process.env.ALLOW_CLEARTEXT === '1' ? [['expo-build-properties', { android: { usesCleartextTraffic: true } }]] : []),
  ],
});
