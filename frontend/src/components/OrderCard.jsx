import { Pressable, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { money, dateLabel } from '@laundrytrack/shared';
import { Badge, Icon, colors, s } from './UI';
export default function OrderCard({ order, staff }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${order.number}, ${order.expected_count} garments, view order`}
      onPress={() => router.push(`/order/${order.id}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      <View style={s.row}>
        <View style={styles.icon}>
          <Icon name="bag-handle-outline" size={23} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.number}>{order.number}</Text>
          <Text style={styles.meta}>
            {staff
              ? order.customer_name
              : `${order.expected_count} garments · ${order.garment_count} registered`}
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </View>
      <View style={[s.row, { marginTop: 16 }]}>
        <Badge stage={order.stage} />
        <Text style={styles.total}>{money(order.total)}</Text>
      </View>
      <View style={styles.bottom}>
        <Icon name="calendar-outline" size={15} color={colors.muted} />
        <Text style={styles.date}>
          {dateLabel(order.pickup_date + 'T12:00:00')} · {order.slot}
        </Text>
        {staff && !order.assigned_to && <Text style={styles.unassigned}>Unassigned</Text>}
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 17,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'white',
    marginBottom: 13,
  },
  icon: {
    height: 43,
    width: 43,
    borderRadius: 14,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontSize: 15, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 5 },
  bottom: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 15,
    paddingTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  date: { fontSize: 11, color: colors.muted },
  total: { fontSize: 18, fontWeight: '800', color: colors.green },
  unassigned: { fontSize: 10, fontWeight: '600', color: '#B16A25', marginLeft: 'auto' },
});
