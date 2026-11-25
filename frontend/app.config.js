export default ({ config }) => {
  const production = process.env.APP_VARIANT === 'production';
  if (production) {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (
      !apiUrl ||
      !/^https:\/\/[^/?#]+\/?$/.test(apiUrl) ||
      new URL(apiUrl).username ||
      new URL(apiUrl).password
    )
      throw new Error(
        'Production builds require EXPO_PUBLIC_API_URL set to an HTTPS server address without /api.',
      );
  }
  return {
    ...config,
    platforms: ['android', 'ios'],
    extra: { ...config.extra, apiRequiresHttps: production },
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios.infoPlist,
        NSAppTransportSecurity: production
          ? { NSAllowsLocalNetworking: true }
          : { NSAllowsArbitraryLoads: true, NSAllowsLocalNetworking: true },
      },
    },
    plugins: [
      ...config.plugins.filter((p) => (Array.isArray(p) ? p[0] : p) !== 'expo-build-properties'),
      'expo-sharing',
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: !production,
            compileSdkVersion: 37,
            buildToolsVersion: '37.0.0',
            targetSdkVersion: 36,
          },
        },
      ],
    ],
  };
};
