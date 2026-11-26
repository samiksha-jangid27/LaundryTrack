export default ({ config }) => {
  const production = process.env.APP_VARIANT === 'production';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://laundrytrack-1.onrender.com';
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || config.extra?.eas?.projectId;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  if (
    projectId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
  )
    throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID must be the UUID from your Expo project.');
  if (googleIosClientId && !googleIosUrlScheme)
    throw new Error('Set GOOGLE_IOS_URL_SCHEME when configuring Google sign-in for iOS.');
  if (production) {
    if (
      !apiUrl ||
      !/^https:\/\/[^/?#]+\/?$/.test(apiUrl) ||
      new URL(apiUrl).username ||
      new URL(apiUrl).password
    )
      throw new Error(
        'Production builds require EXPO_PUBLIC_API_URL to be an HTTPS server address without /api.',
      );
  }
  return {
    ...config,
    platforms: ['android', 'ios'],
    extra: {
      ...config.extra,
      apiUrl,
      apiRequiresHttps: production,
      googleWebClientId,
      googleIosClientId,
      ...(projectId ? { eas: { projectId } } : {}),
    },
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
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
      ['expo-notifications', { color: '#007F75', defaultChannel: 'updates' }],
      [
        'expo-splash-screen',
        { backgroundColor: '#007F75', image: './assets/splash-icon.png', imageWidth: 180 },
      ],
      ...(googleIosUrlScheme
        ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }]]
        : []),
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
