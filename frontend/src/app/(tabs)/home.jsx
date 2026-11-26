import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { canOperate, money } from '@laundrytrack/shared';
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
  Brand,
  SectionTitle,
  colors,
  s,
} from '../../components/UI';
import OrderCard from '../../components/OrderCard';
import NotificationBell from '../../components/NotificationBell';
const serviceIcons = {
  'wash-fold': 'water-outline',
  'wash-iron': 'shirt-outline',
  'dry-clean': 'sparkles-outline',
  'steam-iron': 'flash-outline',
  linen: 'bed-outline',
};
export default function Home() {
  const { user } = useSession();
  const staff = canOperate(user);
  const { data, error, loading, refreshing, reload, offline } = useResource('/orders');
  const overview = useResource(staff ? '/outlet/summary' : '/services');
  const orders = data?.orders || [];
  const active = orders.filter((order) => !['cancelled', 'delivered'].includes(order.stage));
  const booked = orders.filter((order) => order.stage === 'booked');
  const featured = ['wash-fold', 'wash-iron', 'dry-clean']
    .map((id) => overview.data?.services?.find((service) => service.id === id))
    .filter(Boolean);
  const recent = staff
    ? [...booked, ...active.filter((order) => order.stage !== 'booked')].slice(0, 3)
    : orders.slice(0, 3);
  const navigate = (stage) => router.push({ pathname: '/(tabs)/orders', params: { stage } });
  return (
    <Screen
      refreshing={refreshing || overview.refreshing}
      onRefresh={() => {
        reload();
        overview.reload();
      }}
    >
      <View style={s.row}>
        <Brand small />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <NotificationBell />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open account"
            onPress={() => router.push('/(tabs)/account')}
            style={styles.avatar}
          >
            <Text style={{ color: colors.green, fontWeight: '800' }}>
              {user.name[0]?.toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>
      <Heading
        eyebrow={
          staff ? `${user.role === 'owner' ? 'Owner' : 'Staff'} dashboard` : 'Fresh care, delivered'
        }
        title={staff ? `Let's get things moving.` : `Hey ${user.name.split(' ')[0]} 👋`}
        subtitle={
          staff
            ? 'Manage pickup requests, garment care and customer support.'
            : 'A fresh wardrobe. One less thing on your list.'
        }
      />
      <Card style={styles.hero}>
        <View style={styles.heroBubble} />
        <View style={styles.heroIcon}>
          <Icon
            name={staff ? 'clipboard-outline' : 'shirt-outline'}
            size={46}
            color={colors.green}
          />
        </View>
        <View style={styles.pill}>
          <Icon name={staff ? 'time-outline' : 'bicycle-outline'} size={14} color={colors.green} />
          <Text style={styles.pillText}>
            {staff ? `${booked.length} pickup requests` : 'Doorstep pickup & delivery'}
          </Text>
        </View>
        <Text style={styles.heroTitle}>
          {staff ? 'New requests.\nReady for your care.' : 'Laundry day,\nwithout the laundry.'}
        </Text>
        <Text style={styles.heroBody}>
          {staff
            ? 'Assign a team member and confirm the pickup count.'
            : 'From just one garment. Clear prices, zero delivery charge.'}
        </Text>
        <Button
          title={staff ? 'Review requests' : 'Book a pickup'}
          icon="arrow-forward"
          onPress={() => (staff ? navigate('booked') : router.push('/(tabs)/book'))}
          style={{ alignSelf: 'flex-start', backgroundColor: colors.lime, marginTop: 16 }}
          variant="secondary"
        />
      </Card>
      <View style={styles.metrics}>
        <Pressable
          onPress={() => navigate('active')}
          accessibilityRole="button"
          style={[styles.metric, { backgroundColor: colors.mint }]}
        >
          <Icon name="bag-handle-outline" size={20} />
          <Text style={styles.metricValue}>{active.length}</Text>
          <Text style={styles.metricLabel}>Active orders</Text>
        </Pressable>
        <Pressable
          onPress={() => navigate(staff ? 'issues' : 'delivered')}
          accessibilityRole="button"
          style={[styles.metric, { backgroundColor: staff ? '#FFF0E9' : '#EFEBFF' }]}
        >
          <Icon
            name={staff ? 'chatbubble-ellipses-outline' : 'checkmark-done-outline'}
            size={20}
            color={staff ? '#C0603B' : colors.purple}
          />
          <Text style={[styles.metricValue, { color: staff ? '#C0603B' : colors.purple }]}>
            {staff
              ? (overview.data?.openIssues ?? '—')
              : orders.filter((o) => o.stage === 'delivered').length}
          </Text>
          <Text style={styles.metricLabel}>{staff ? 'Open complaints' : 'Delivered'}</Text>
        </Pressable>
      </View>
      {staff && (
        <Card>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
                {overview.data?.openQueries ?? '—'} open queries
              </Text>
              <Body>
                {user.role === 'owner'
                  ? 'Customer and staff conversations'
                  : 'Your queries and assigned customer help'}
              </Body>
            </View>
            <Button
              title="Inbox"
              variant="secondary"
              onPress={() => router.push('/(tabs)/support')}
            />
          </View>
          {user.role === 'owner' && (
            <Button
              title="Manage customer & staff accounts"
              variant="secondary"
              icon="people-outline"
              onPress={() => router.push('/(tabs)/manage')}
            />
          )}
        </Card>
      )}
      {!staff && (
        <>
          <View style={[s.row, { marginBottom: 12 }]}>
            <SectionTitle>Care for every garment</SectionTitle>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/book')}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          </View>
          <Feedback error={overview.error && !overview.offline ? overview.error : null} />
          <View style={styles.services}>
            {featured.map((service, index) => (
              <Pressable
                key={service.id}
                accessibilityRole="button"
                accessibilityLabel={`${service.name}, ${money(service.price)} per item, book pickup`}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/book', params: { serviceId: service.id } })
                }
                style={styles.service}
              >
                <View
                  style={[
                    styles.serviceIcon,
                    { backgroundColor: [colors.mint, '#FFF0E9', '#EFEBFF'][index] },
                  ]}
                >
                  <Icon name={serviceIcons[service.id] || 'shirt-outline'} size={25} />
                </View>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.servicePrice}>
                  {money(service.price)}
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '400' }}>
                    {' '}
                    / item
                  </Text>
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <View style={[s.row, { marginBottom: 12 }]}>
        <SectionTitle>{staff ? 'Requests & active work' : 'Your latest orders'}</SectionTitle>
        <Pressable accessibilityRole="button" onPress={() => navigate(staff ? 'active' : 'all')}>
          <Text style={styles.link}>View all</Text>
        </Pressable>
      </View>
      <Feedback
        error={!offline && error}
        message={offline ? 'Showing saved orders. Pull to refresh when connected.' : null}
      />
      {loading ? (
        <Loading />
      ) : recent.length ? (
        recent.map((order) => <OrderCard key={order.id} order={order} staff={staff} />)
      ) : (
        <Empty title={staff ? 'Your queue is clear' : 'Your first pickup awaits'}>
          {staff
            ? 'New customer bookings appear here. Pull to refresh.'
            : 'Book your first pickup and track every step here.'}
        </Empty>
      )}
      {staff && <Feedback error={overview.error && !overview.offline ? overview.error : null} />}
      <View style={styles.trust}>
        <Icon name="shield-checkmark-outline" size={22} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontWeight: '700', marginBottom: 3 }}>
            Every garment accounted for
          </Text>
          <Body>Individual garment IDs. Checked packing. Verified returns.</Body>
        </View>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { backgroundColor: colors.green, padding: 22, overflow: 'hidden', borderWidth: 0 },
  heroBubble: {
    position: 'absolute',
    right: -40,
    top: -55,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#14968A',
  },
  heroIcon: {
    position: 'absolute',
    right: 20,
    top: 63,
    height: 80,
    width: 76,
    borderRadius: 24,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '10deg' }],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#DDF4E6',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: { fontSize: 10, color: colors.green, fontWeight: '700' },
  heroTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.6,
    maxWidth: '76%',
    marginTop: 17,
  },
  heroBody: { fontSize: 12, lineHeight: 19, color: '#D7F4EB', marginTop: 9, maxWidth: '72%' },
  metrics: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  metric: { flex: 1, padding: 16, borderRadius: 20 },
  metricValue: { color: colors.green, fontSize: 28, fontWeight: '800', marginTop: 10 },
  metricLabel: { fontSize: 12, color: colors.muted, marginTop: 4, fontWeight: '500' },
  link: { fontSize: 12, color: colors.green, fontWeight: '700', paddingBottom: 12 },
  services: { flexDirection: 'row', gap: 10, marginBottom: 26 },
  service: {
    flex: 1,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  serviceIcon: {
    height: 42,
    width: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  serviceName: { fontSize: 12, fontWeight: '700', color: colors.ink, minHeight: 30 },
  servicePrice: { fontSize: 16, fontWeight: '800', color: colors.green, marginTop: 7 },
  trust: {
    flexDirection: 'row',
    gap: 12,
    padding: 18,
    marginTop: 18,
    backgroundColor: '#E7F3EC',
    borderRadius: 20,
  },
});
