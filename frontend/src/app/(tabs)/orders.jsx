import { useState } from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { canOperate, STAGE_LABELS } from '@laundrytrack/shared';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/hooks';
import { Screen, Heading, Field, Feedback, Empty, Loading, colors } from '../../components/UI';
import OrderCard from '../../components/OrderCard';
export default function Orders() {
  const { user } = useSession();
  const staff = canOperate(user);
  const { data, error, loading, offline, refreshing, reload } = useResource('/orders');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active');
  const rows = (data?.orders || []).filter(
    (o) =>
      (filter === 'all' ||
        (filter === 'active'
          ? !['cancelled', 'delivered'].includes(o.stage)
          : o.stage === filter)) &&
      `${o.number} ${o.customer_name}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Heading
        eyebrow={staff ? 'The outlet workspace' : 'Every piece has a journey'}
        title={staff ? 'Orders, in good order.' : 'Your laundry journal.'}
        subtitle="Choose an order for receipts, garment details and the latest handoff."
      />
      <Field
        label="Search orders"
        value={search}
        onChangeText={setSearch}
        placeholder={staff ? 'Order number or customer' : 'Order number'}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
      >
        {[['active', 'Active'], ['all', 'All orders'], ...Object.entries(STAGE_LABELS)].map(
          ([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === key }}
              onPress={() => setFilter(key)}
              style={{
                paddingHorizontal: 15,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: filter === key ? colors.green : 'white',
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: filter === key ? 'white' : colors.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ),
        )}
      </ScrollView>
      <Feedback
        error={!offline && error}
        message={
          offline ? 'Saved snapshot. Connect and pull to refresh for the latest status.' : null
        }
      />
      {loading ? (
        <Loading />
      ) : rows.length ? (
        rows.map((o) => <OrderCard key={o.id} order={o} staff={staff} />)
      ) : (
        <Empty title="All clear here">No orders match this view. Try another filter.</Empty>
      )}
    </Screen>
  );
}
