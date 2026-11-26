import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Redirect } from 'expo-router';
import { registerSchema, loginSchema } from '@laundrytrack/shared';
import { useSession } from '../lib/session';
import { Brand, Button, Field, Icon, colors } from '../components/UI';
import LaunchScreen from '../components/LaunchScreen';

export default function SignIn() {
  const { user, loading, login, notice, storageError } = useSession();
  const { height, fontScale } = useWindowDimensions();
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [visible, setVisible] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const compact = keyboard || height < 720 || fontScale > 1.2;
  const register = mode === 'register';
  const profile = register && step === 1;
  if (loading) return <LaunchScreen />;
  if (user) return <Redirect href="/(tabs)/home" />;
  const update = (key) => (value) => setForm((old) => ({ ...old, [key]: value }));
  function changeMode(value) {
    if (busy) return;
    setMode(value);
    setStep(0);
    setError('');
  }
  async function submit() {
    if (busy) return;
    setError('');
    if (register && step === 0) {
      const result = loginSchema
        .extend({ password: registerSchema.shape.password })
        .safeParse(form);
      if (!result.success) {
        setError(result.error.issues[0].message);
        Keyboard.dismiss();
        return;
      }
      Keyboard.dismiss();
      setStep(1);
      return;
    }
    setBusy(true);
    Keyboard.dismiss();
    try {
      const parsed = (register ? registerSchema : loginSchema).safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      await login(parsed.data, register);
    } catch (e) {
      setError(e.message);
      Keyboard.dismiss();
    } finally {
      setBusy(false);
    }
  }
  const title = profile ? 'A little about you' : register ? 'Your fresh start' : 'Welcome back';
  const subtitle = profile
    ? 'Your name and number help us find your doorstep.'
    : 'Fresh laundry. More time for you.';
  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {!keyboard && (
          <View style={[styles.hero, compact && styles.heroCompact]}>
            <Brand light small={compact} />
            {!compact && (
              <>
                <View style={styles.heroArt}>
                  <View style={styles.shirt}>
                    <Icon name="shirt-outline" size={56} color={colors.green} />
                  </View>
                  <View style={styles.spark}>
                    <Icon name="sparkles" size={20} color="white" />
                  </View>
                  <View style={styles.pickupTag}>
                    <Icon name="bicycle-outline" size={18} />
                    <Text style={styles.pickupText}>Doorstep pickup</Text>
                  </View>
                </View>
                <Text style={styles.heroText}>Less laundry.{'\n'}More life.</Text>
              </>
            )}
          </View>
        )}
        <View
          style={[
            styles.panel,
            compact && { paddingTop: 16, paddingBottom: 12 },
            keyboard && { flex: 1, justifyContent: 'flex-start', paddingTop: 8, paddingBottom: 8 },
          ]}
        >
          {!keyboard && (
            <View style={styles.tabs}>
              {[
                ['login', 'Sign in'],
                ['register', 'Create account'],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === value }}
                  disabled={busy}
                  onPress={() => changeMode(value)}
                  style={[styles.tab, mode === value && styles.tabActive]}
                >
                  <Text style={[styles.tabText, mode === value && { color: colors.green }]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={[styles.formHeading, compact && { marginTop: 6, marginBottom: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={[styles.title, compact && { fontSize: 22 }]}>
                {title}
              </Text>
              {!keyboard && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {profile && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                disabled={busy}
                onPress={() => {
                  setStep(0);
                  setError('');
                }}
                style={styles.back}
              >
                <Icon name="arrow-back" size={20} />
              </Pressable>
            )}
          </View>
          {profile ? (
            <>
              <Field
                compact
                label="Full name"
                icon="person-outline"
                value={form.name}
                onChangeText={update('name')}
                placeholder="Your name"
                autoComplete="name"
                maxLength={80}
              />
              <Field
                compact
                label="Mobile number"
                icon="call-outline"
                value={form.phone}
                onChangeText={update('phone')}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={10}
                onSubmitEditing={submit}
              />
            </>
          ) : (
            <>
              <Field
                compact
                label="Email address"
                icon="mail-outline"
                value={form.email}
                onChangeText={update('email')}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                maxLength={254}
              />
              <Field
                compact
                label={register ? 'Password · 10+ characters' : 'Password'}
                icon="lock-closed-outline"
                value={form.password}
                onChangeText={update('password')}
                placeholder="Your password"
                secureTextEntry={!visible}
                autoCapitalize="none"
                autoComplete={register ? 'new-password' : 'current-password'}
                maxLength={128}
                returnKeyType="done"
                onSubmitEditing={submit}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={visible ? 'Hide password' : 'Show password'}
                    onPress={() => setVisible(!visible)}
                    hitSlop={8}
                    style={{ padding: 12 }}
                  >
                    <Icon
                      name={visible ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.muted}
                    />
                  </Pressable>
                }
              />
            </>
          )}
          {(error || storageError || notice) && (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.feedback, (error || storageError) && { color: '#B54735' }]}
            >
              {error || storageError?.message || notice}
            </Text>
          )}
          <Button
            title={profile ? 'Create account' : register ? 'Continue' : 'Sign in'}
            busy={busy}
            icon="arrow-forward"
            onPress={submit}
            style={{ marginTop: 2, minHeight: compact ? 46 : 50 }}
          />
          {!compact && (
            <View style={styles.trust}>
              <Icon name="shield-checkmark-outline" size={15} />
              <Text style={styles.trustText}>Secure sign-in. Tracked garments. Clear prices.</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.green },
  hero: {
    flex: 1,
    minHeight: 150,
    padding: 24,
    paddingTop: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  heroCompact: {
    minHeight: 70,
    paddingHorizontal: 22,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  heroText: {
    color: 'white',
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.9,
    marginTop: 18,
  },
  heroArt: { position: 'absolute', right: 30, bottom: 35, alignItems: 'center' },
  shirt: {
    width: 106,
    height: 112,
    borderRadius: 32,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-10deg' }],
  },
  spark: {
    position: 'absolute',
    right: -12,
    top: -13,
    width: 37,
    height: 37,
    borderRadius: 14,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 12,
    marginTop: -8,
  },
  pickupText: { fontSize: 10, fontWeight: '700', color: colors.green },
  panel: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 24,
  },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 15, backgroundColor: colors.bg },
  tab: { flex: 1, minHeight: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  tabActive: {
    backgroundColor: 'white',
    elevation: 1,
    shadowColor: '#12313E',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  formHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    marginBottom: 18,
  },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.mint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedback: { fontSize: 12, lineHeight: 17, color: colors.green, marginBottom: 10 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 17 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { fontSize: 11, color: colors.muted },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  trustText: { fontSize: 10, color: colors.muted },
  resend: { padding: 14, alignItems: 'center' },
});
