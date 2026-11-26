import { useEffect, useState } from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { canOperate, STAGE_LABELS, dateLabel } from '@laundrytrack/shared';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/hooks';
import { filterOrders } from '../../lib/order-filters';
import {
  Screen,
  Heading,
  Field,
  Feedback,
  Empty,
  Loading,
  Chip,
  Icon,
  colors,
  s,
} from '../../components/UI';
import OrderCard from '../../components/OrderCard';
export default function Orders() {
  const { user } = useSession();
  const operator = canOperate(user);
  const [personal, setPersonal] = useState(false);
  const staff = operator && !personal;
  const params = useLocalSearchParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(staff ? 'booked' : 'active');
  const [sort, setSort] = useState('newest');
  const [mine, setMine] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  useEffect(() => {
    const value = params.stage;
    if (
      ['active', 'all', ...Object.keys(STAGE_LABELS), ...(operator ? ['issues'] : [])].includes(
        value,
      )
    )
      setFilter(value);
    if (value) {
      setPersonal(false);
      router.setParams({ stage: undefined });
    }
    if (params.scope === 'mine') {
      setPersonal(true);
      setFilter('active');
      router.setParams({ scope: undefined });
    }
  }, [params.stage, params.scope, operator]);
  const issuesView = staff && filter === 'issues';
  const resource = useResource(
    issuesView ? '/outlet/issues' : personal ? '/orders?scope=mine' : '/orders',
  );
  const { data, error, loading, offline, refreshing, reload } = resource;
  const orders = data?.orders || [];
  const rows = filterOrders(orders, { stage: filter, search, mine, userId: user.id, sort });
  const issues = (data?.issues || []).filter((issue) =>
    `${issue.order.number} ${issue.order.customer.name} ${issue.message} ${issue.category}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const count = issuesView ? issues.length : rows.length;
  const filters = staff
    ? [
        ['booked', 'New requests'],
        ['active', 'In progress'],
        ['issues', 'Complaints'],
        ['all', 'All orders'],
      ]
    : [
        ['active', 'Active'],
        ['all', 'All orders'],
      ];
  const extraFilters = Object.entries(STAGE_LABELS).filter(
    ([stage]) => !filters.some(([key]) => key === stage),
  );
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Heading
        eyebrow={staff ? 'Outlet operations' : 'Your laundry, organised'}
        title={staff ? 'Requests & orders' : 'My orders'}
        subtitle={
          staff
            ? user.role === 'owner'
              ? 'Review requests, assign staff and resolve customer issues.'
              : 'Work on your assigned pickups and customer issues.'
            : 'Track your pickups, care progress and completed deliveries.'
        }
      />
      {user.role === 'staff' && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <Chip
            selected={!personal}
            onPress={() => {
              setPersonal(false);
              setMine(false);
              setFilter('booked');
            }}
          >
            Assigned work
          </Chip>
          <Chip
            selected={personal}
            onPress={() => {
              setPersonal(true);
              setMine(false);
              setFilter('active');
            }}
          >
            My pickups
          </Chip>
        </View>
      )}
      <Field
        label={issuesView ? 'Search complaints' : 'Search orders'}
        icon="search-outline"
        value={search}
        onChangeText={setSearch}
        placeholder={staff ? 'Order number or customer name' : 'Search by order number'}
        autoCapitalize="none"
        trailing={
          search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearch('')}
              style={{ padding: 12 }}
            >
              <Icon name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {[...filters, ...extraFilters].map(([key, label]) => (
          <Chip key={key} selected={filter === key} onPress={() => setFilter(key)}>
            {label}
            {key === 'booked' && !issuesView
              ? ` · ${orders.filter((order) => order.stage === key).length}`
              : ''}
          </Chip>
        ))}
      </ScrollView>
      {!issuesView && (
        <View style={[s.row, { marginBottom: 14 }]}>
          <Text style={styles.count}>
            {count} {count === 1 ? 'order' : 'orders'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            {user.role === 'owner' && staff && (
              <Chip selected={mine} icon="person-outline" onPress={() => setMine(!mine)}>
                Assigned to me
              </Chip>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change sort order"
              onPress={() => setSortOpen(!sortOpen)}
              style={styles.sort}
            >
              <Icon name="swap-vertical-outline" size={17} />
              <Text style={styles.sortText}>Sort</Text>
            </Pressable>
          </View>
        </View>
      )}
      {issuesView && (
        <Text style={[styles.count, { marginBottom: 14 }]}>
          {count} open {count === 1 ? 'complaint' : 'complaints'} · oldest first
        </Text>
      )}
      {sortOpen && !issuesView && (
        <View style={styles.sortOptions}>
          {[
            ['newest', 'Newest'],
            ['pickup', 'Pickup date'],
            ['amount', 'Highest amount'],
          ].map(([key, label]) => (
            <Chip
              key={key}
              selected={sort === key}
              onPress={() => {
                setSort(key);
                setSortOpen(false);
              }}
            >
              {label}
            </Chip>
          ))}
        </View>
      )}
      <Feedback
        error={!offline && error}
        message={offline ? 'Showing saved data. Pull to refresh when connected.' : null}
      />
      {loading ? (
        <Loading />
      ) : count ? (
        issuesView ? (
          issues.map((issue) => (
            <Pressable
              key={issue.id}
              accessibilityRole="button"
              accessibilityLabel={`Open complaint for ${issue.order.number}`}
              onPress={() => router.push(`/order/${issue.order.id}`)}
              style={styles.issue}
            >
              <View style={s.row}>
                <View style={styles.issueBadge}>
                  <Icon name="chatbubble-ellipses-outline" size={17} color="#BB6041" />
                  <Text style={styles.category}>{issue.category.toUpperCase()}</Text>
                </View>
                <Icon name="chevron-forward" size={18} />
              </View>
              <Text style={styles.issueTitle}>
                {issue.order.number} · {issue.order.customer.name}
              </Text>
              <Text style={styles.issueMessage} numberOfLines={3}>
                {issue.message}
              </Text>
              <Text style={styles.count}>Opened {dateLabel(issue.created_at)}</Text>
            </Pressable>
          ))
        ) : (
          rows.map((order) => <OrderCard key={order.id} order={order} staff={staff} />)
        )
      ) : (
        <>
          <Empty
            title={
              issuesView
                ? 'No open complaints'
                : search || mine
                  ? 'No matching orders'
                  : filter === 'booked'
                    ? 'No new pickup requests'
                    : 'Nothing here yet'
            }
          >
            {search || mine
              ? 'Try a different search or clear the filters.'
              : issuesView
                ? 'Customer issues will appear here when reported.'
                : 'New orders and status updates appear here. Pull to refresh.'}
          </Empty>
          {(search || mine || !['active', 'booked'].includes(filter)) && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSearch('');
                setMine(false);
                setFilter('all');
              }}
              style={{ alignItems: 'center', padding: 18 }}
            >
              <Text style={styles.sortText}>Reset filters</Text>
            </Pressable>
          )}
        </>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  filters: { gap: 8, paddingBottom: 18 },
  count: { fontSize: 12, color: colors.muted },
  sort: { flexDirection: 'row', gap: 4, alignItems: 'center', padding: 8 },
  sortText: { fontSize: 12, color: colors.green, fontWeight: '700' },
  sortOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  issue: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
  },
  issueBadge: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#FFF0E8',
    padding: 8,
    borderRadius: 9,
  },
  category: { fontSize: 10, fontWeight: '700', color: '#BB6041' },
  issueTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 14 },
  issueMessage: { color: colors.muted, fontSize: 13, lineHeight: 20, marginVertical: 10 },
});
