import { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/hooks';
import { api } from '../../lib/api';
import {
  Screen,
  Heading,
  Card,
  Body,
  Button,
  Field,
  Feedback,
  Chip,
  Empty,
  Loading,
  colors,
  s,
} from '../../components/UI';
function ManagedAccount({ account, reload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone);
  async function change(values) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/management/users/${account.id}`, {
        method: 'PATCH',
        body: { version: account.version, ...values },
      });
      setEditing(false);
      await reload();
    } catch (e) {
      setError(e);
      if (e.status === 409) await reload();
    } finally {
      setBusy(false);
    }
  }
  const protectedAccount = account.role === 'owner';
  return (
    <Card>
      <View style={s.row}>
        <Text style={{ flex: 1, fontWeight: '800', fontSize: 17, color: colors.ink }}>
          {account.name}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: account.active ? colors.green : '#B54735',
          }}
        >
          {account.active ? 'ENABLED' : 'SUSPENDED'}
        </Text>
      </View>
      <Body style={{ marginTop: 8 }}>{account.email}</Body>
      <Body>
        {account.phone || 'No phone added'} · {account.role}
      </Body>
      <Body style={{ marginTop: 8 }}>
        {account._count.orders} personal orders · {account._count.assignments} assignments ·{' '}
        {account._count.tickets} queries
      </Body>
      <Text
        style={{
          color: account.email_verified_at ? colors.green : '#AD7025',
          fontSize: 11,
          marginTop: 10,
        }}
      >
        {account.email_verified_at ? 'Email verified' : 'Email not verified'}
      </Text>
      {account.staff_requested_at && (
        <View
          style={{ padding: 12, borderRadius: 12, backgroundColor: colors.mint, marginTop: 12 }}
        >
          <Text style={{ color: colors.green, fontWeight: '700' }}>Staff access requested</Text>
          <Body>Review this person before granting outlet access.</Body>
        </View>
      )}
      <Feedback error={error} />
      {!protectedAccount && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
            <Chip
              selected={account.role === 'customer'}
              onPress={() =>
                !busy &&
                account.role !== 'customer' &&
                Alert.alert(
                  'Change to customer?',
                  'Active work will be unassigned for owner review, and current sessions will end.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Change role', onPress: () => change({ role: 'customer' }) },
                  ],
                )
              }
            >
              Customer
            </Chip>
            <Chip
              selected={account.role === 'staff'}
              onPress={() =>
                !busy &&
                account.role !== 'staff' &&
                Alert.alert(
                  'Approve staff access?',
                  'This person will be able to handle assigned orders and customer queries. Their email must be verified.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Approve', onPress: () => change({ role: 'staff' }) },
                  ],
                )
              }
            >
              Staff
            </Chip>
            <Chip
              onPress={() => {
                if (!busy) {
                  setName(account.name);
                  setPhone(account.phone);
                  setEditing(!editing);
                }
              }}
            >
              Edit details
            </Chip>
          </View>
          {editing && (
            <View style={{ marginTop: 16 }}>
              <Field label="Full name" value={name} onChangeText={setName} maxLength={80} />
              <Field
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />
              <Button title="Save details" busy={busy} onPress={() => change({ name, phone })} />
            </View>
          )}
          {account.staff_requested_at && (
            <Button
              title="Decline staff request"
              variant="secondary"
              disabled={busy}
              onPress={() => change({ dismissStaffRequest: true })}
            />
          )}
          <Button
            title={account.active ? 'Suspend account' : 'Enable account'}
            variant="secondary"
            busy={busy}
            onPress={() =>
              account.active
                ? Alert.alert(
                    'Suspend this account?',
                    'They will be signed out. Active work will be unassigned so you can reassign it.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Suspend',
                        style: 'destructive',
                        onPress: () => change({ active: false }),
                      },
                    ],
                  )
                : change({ active: true })
            }
          />
        </>
      )}
      {protectedAccount && (
        <Body style={{ marginTop: 12 }}>
          Owner access is protected. This account cannot be changed here.
        </Body>
      )}
    </Card>
  );
}
export default function Manage() {
  const { user } = useSession();
  const [tab, setTab] = useState('users');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [state, setState] = useState('all');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const path =
    tab === 'activity'
      ? '/management/activity'
      : `/management/users?q=${encodeURIComponent(query)}&role=${role}&state=${state}`;
  const { data, error, offline, loading, refreshing, reload } = useResource(path);
  if (user.role !== 'owner') return <Redirect href="/(tabs)/home" />;
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Heading
        eyebrow="Owner controls"
        title="People & accounts"
        subtitle="Manage customer and staff access, review requests and follow account activity."
      />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
        <Chip selected={tab === 'users'} onPress={() => setTab('users')}>
          Accounts
        </Chip>
        <Chip selected={tab === 'activity'} onPress={() => setTab('activity')}>
          Activity
        </Chip>
      </View>
      <Feedback
        error={!offline && error}
        message={offline ? 'Saved account data. Reconnect before making changes.' : null}
      />
      {tab === 'users' && (
        <>
          <Card style={{ backgroundColor: colors.mint }}>
            <Text style={{ color: colors.green, fontSize: 22, fontWeight: '800' }}>
              {data ? data.staffRequests : '—'}
            </Text>
            <Body>Staff access requests awaiting your review</Body>
          </Card>
          <Field
            label="Search accounts"
            icon="search-outline"
            value={search}
            onChangeText={setSearch}
            placeholder="Name, email or phone"
            maxLength={80}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {[
              ['all', 'Everyone'],
              ['customer', 'Customers'],
              ['staff', 'Staff'],
              ['owner', 'Owners'],
            ].map(([key, label]) => (
              <Chip key={key} selected={role === key} onPress={() => setRole(key)}>
                {label}
              </Chip>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
            {[
              ['all', 'All states'],
              ['active', 'Enabled'],
              ['inactive', 'Suspended'],
              ['pending', 'Staff requests'],
            ].map(([key, label]) => (
              <Chip key={key} selected={state === key} onPress={() => setState(key)}>
                {label}
              </Chip>
            ))}
          </View>
          {loading ? (
            <Loading />
          ) : data?.users?.length ? (
            data.users.map((account) => (
              <ManagedAccount
                key={`${account.id}:${account.version}`}
                account={account}
                reload={reload}
              />
            ))
          ) : (
            <Empty title="No matching accounts">Try another name or filter.</Empty>
          )}
          {data?.users?.length === 200 && (
            <Body>Showing the latest 200 matches. Narrow your search for older accounts.</Body>
          )}
        </>
      )}
      {tab === 'activity' &&
        (loading ? (
          <Loading />
        ) : data?.activity?.length ? (
          data.activity.map((entry) => (
            <Card key={entry.id}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>{entry.target.name}</Text>
              <Body style={{ marginTop: 7 }}>{entry.detail}</Body>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 10 }}>
                {entry.actor.name} · {new Date(entry.created_at).toLocaleString('en-IN')}
              </Text>
            </Card>
          ))
        ) : (
          <Empty title="No account activity yet">
            Profile, access and staff-request changes will appear here.
          </Empty>
        ))}
    </Screen>
  );
}
