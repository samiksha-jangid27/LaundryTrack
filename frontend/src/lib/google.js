import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

export async function getGoogleIdToken() {
  if (isRunningInExpoGo())
    throw new Error('Google sign-in needs the installed LaundryTrack app. Use email in Expo Go.');
  const { googleWebClientId, googleIosClientId } = Constants.expoConfig?.extra || {};
  if (
    typeof googleWebClientId !== 'string' ||
    !googleWebClientId ||
    (Platform.OS === 'ios' && !googleIosClientId)
  )
    throw new Error('Google sign-in is currently unavailable. Please use email.');
  const { GoogleSignin, isSuccessResponse } =
    await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId || undefined,
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  if (!response.data.idToken)
    throw new Error('Google could not complete sign-in. Please try again.');
  return response.data.idToken;
}
