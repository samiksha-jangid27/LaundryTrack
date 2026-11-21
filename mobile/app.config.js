export default ({ config }) => {
  const production = process.env.APP_VARIANT === 'production';
  return {
    ...config,
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
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: !production,
            compileSdkVersion: 36,
            buildToolsVersion: '36.0.0',
            targetSdkVersion: 36,
          },
        },
      ],
    ],
  };
};
