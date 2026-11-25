import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../lib/session';
import {
  Screen,
  Heading,
  Card,
  Button,
  Field,
  Feedback,
  Loading,
  Icon,
  colors,
} from '../components/UI';
export default function SignIn() {
  const { user, loading, login, notice, storageError } = useSession();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (loading) return <Loading />;
  if (user) return <Redirect href="/(tabs)/home" />;
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login({ name, phone, email, password }, register);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Icon name="shirt-outline" color={colors.lime} size={24} />
        </View>
        <Text style={styles.brandText}>
          Laundry<Text style={{ fontWeight: '400' }}>Track</Text>
        </Text>
      </View>
      <View style={styles.intro}>
        <View style={styles.orbit}>
          <Icon name="shirt-outline" color="#568a5f" size={68} />
          <View style={styles.smallTag}>
            <Icon name="checkmark-circle" size={20} />
            <Text style={{ color: colors.green, fontSize: 11, fontWeight: '600' }}>
              Every piece matters
            </Text>
          </View>
        </View>
        <Heading
          eyebrow="A little care. A lighter day."
          title={register ? 'Your fresh start.' : 'Fresh clothes.\nA lighter mind.'}
          subtitle="Doorstep laundry with a clear trail for every garment."
        />
      </View>
      <Card>
        <Heading title={register ? 'Create your account' : 'Welcome back.'} />
        <Feedback error={error || storageError} message={notice} />
        {register && (
          <>
            <Field
              label="Your name"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              maxLength={80}
            />
            <Field
              label="Mobile number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </>
        )}
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          maxLength={254}
        />
        <Field
          label={register ? 'Password · 10+ characters' : 'Password'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          maxLength={128}
        />
        <Button
          title={register ? 'Create account' : 'Sign in'}
          busy={busy}
          onPress={() => submit()}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setRegister(!register);
            setError(null);
          }}
          style={{ padding: 18 }}
        >
          <Text style={{ textAlign: 'center', fontSize: 13, color: colors.green }}>
            {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Text>
        </Pressable>
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15 },
  logo: {
    width: 42,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 23, fontWeight: '700', letterSpacing: -1, color: colors.ink },
  intro: { marginTop: 25 },
  orbit: {
    height: 135,
    backgroundColor: '#e7efdc',
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  smallTag: {
    position: 'absolute',
    bottom: 12,
    right: 18,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 9,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
});
