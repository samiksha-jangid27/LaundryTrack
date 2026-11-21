import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { canOperate } from '@laundrytrack/core';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/hooks';
import {
  Screen,
  Heading,
  Card,
  Body,
  Button,
  Feedback,
  Loading,
  Empty,
  Icon,
  SectionTitle,
  colors,
  s,
} from '../../components/UI';
import OrderCard from '../../components/OrderCard';
export default function Home() {
  const { user, demo } = useSession();
  const staff = canOperate(user);
  const { data, error, loading, refreshing, reload, offline } = useResource('/orders');
  const orders = data?.orders || [];
  const active = orders.filter((o) => !['cancelled', 'delivered'].includes(o.stage));
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <View style={s.row}>
        <Text style={styles.brand}>
          Laundry<Text style={{ fontWeight: '400' }}>Track</Text>
        </Text>
        <View style={styles.avatar}>
          <Text style={{ color: colors.green, fontWeight: '600' }}>{user.name[0]}</Text>
        </View>
      </View>
      {demo && <Text style={styles.demo}>DEMO WORKSPACE · SYNTHETIC ORDERS</Text>}
      <Heading
        eyebrow={staff ? 'The outlet, at a glance' : 'Your everyday, a little lighter'}
        title={
          staff ? 'Good care starts here.' : `Hey ${user.name.split(' ')[0]},\nfresh starts here.`
        }
        subtitle={
          staff
            ? 'A clear trail for every piece in your care.'
            : 'Your laundry is handled. The day is yours.'
        }
      />
      <Card style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon name="shirt-outline" size={48} color="#688b4c" />
        </View>
        <Text style={styles.heroTitle}>
          {staff ? 'Every piece.\nEvery handoff.' : 'A little less laundry.\nA little more life.'}
        </Text>
        <Body style={{ maxWidth: '75%', color: '#62764b', marginTop: 12 }}>
          {staff
            ? 'Register what comes in. Verify what goes out.'
            : 'Book a pickup and follow the care journey, from your door and back.'}
        </Body>
        <Button
          title={staff ? 'Open workspace' : 'Book a pickup'}
          onPress={() => router.push(staff ? '/(tabs)/orders' : '/(tabs)/book')}
          style={{ alignSelf: 'flex-start', marginTop: 22 }}
        />
      </Card>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 23 }}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Active orders</Text>
          <Text style={styles.metricValue}>{active.length}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Garments in care</Text>
          <Text style={styles.metricValue}>{active.reduce((n, o) => n + o.expected_count, 0)}</Text>
        </View>
      </View>
      <View style={[s.row, { marginBottom: 18 }]}>
        <SectionTitle>{staff ? 'Needs attention' : 'Your recent orders'}</SectionTitle>
        <Pressable accessibilityRole="link" onPress={() => router.push('/(tabs)/orders')}>
          <Text style={{ fontSize: 13, color: colors.green, fontWeight: '600' }}>View all</Text>
        </Pressable>
      </View>
      <Feedback
        error={!offline && error}
        message={offline ? 'Showing your saved orders. Pull to refresh when connected.' : null}
      />
      {loading ? (
        <Loading />
      ) : orders.length ? (
        (staff ? active : orders)
          .slice(0, 3)
          .map((o) => <OrderCard key={o.id} order={o} staff={staff} />)
      ) : (
        <Empty title="Your first fresh start awaits">
          Book a pickup to start your laundry journal.
        </Empty>
      )}
      <Card style={{ backgroundColor: '#edf3e4', marginTop: 6 }}>
        <Icon name="scan-outline" size={27} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink, marginVertical: 12 }}>
          A careful return, every time.
        </Text>
        <Body>Each registered garment has its own ID, checked before it comes home.</Body>
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  brand: { fontSize: 23, fontWeight: '700', letterSpacing: -1, color: colors.ink },
  avatar: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: '#e3ebd8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demo: { fontSize: 9, letterSpacing: 1.3, color: '#97a284', marginTop: 18 },
  hero: { backgroundColor: '#e7efda', padding: 24, overflow: 'hidden' },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
    letterSpacing: -0.8,
    color: colors.ink,
    maxWidth: '85%',
  },
  heroIcon: {
    position: 'absolute',
    right: 13,
    top: 24,
    transform: [{ rotate: '12deg' }],
    opacity: 0.65,
  },
  metric: {
    flex: 1,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'white',
  },
  metricLabel: { fontSize: 12, color: colors.muted },
  metricValue: {
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -1,
    color: colors.ink,
    marginTop: 12,
  },
});
