import { useFocusEffect, router } from 'expo-router';
import { useState, useCallback } from 'react';
import { View, Text, Alert } from 'react-native';
import { canOperate, STAGE_LABELS } from '@laundrytrack/shared';
import { useSession } from '../../lib/session';
import { pendingScans, syncPending } from '../../lib/queue';
import { clearPending } from '../../lib/storage';
import { shareOrderExport } from '../../lib/export';
import { useResource } from '../../lib/hooks';
import {
  Screen,
  Heading,
  Card,
  SectionTitle,
  Body,
  Button,
  Feedback,
  Field,
  Icon,
  colors,
  s,
} from '../../components/UI';
function OutletSummary() {
  const { data, error } = useResource('/outlet/summary');
  return (
    <Card>
      <SectionTitle>Your outlet, at a glance</SectionTitle>
      <Feedback error={error} />
      <Body>
        {data?.garmentCount || 0} registered garments in care · {data?.openIssues || 0} open issues
      </Body>
      {data?.counts.map((row) => (
        <View key={row.stage} style={[s.row, { marginTop: 17 }]}>
          <Body>{STAGE_LABELS[row.stage]}</Body>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{row.count}</Text>
        </View>
      ))}
    </Card>
  );
}
export default function Account() {
  const { user, logout, updateProfile, requestStaffAccess, refreshProfile } = useSession();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(pendingScans(user.id).length);
  useFocusEffect(
    useCallback(() => {
      setCount(pendingScans(user.id).length);
      refreshProfile().catch((e) => {
        if (!e.offline && e.status !== 401) setError(e);
      });
    }, [user.id, refreshProfile]),
  );
  async function signOut() {
    if (pendingScans(user.id).length) {
      setError(new Error('Sync or discard the saved scans before signing out.'));
      return;
    }
    setBusy(true);
    try {
      await logout();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Heading
        eyebrow="The little details"
        title="Your account."
        subtitle="Your profile, sign-in methods and saved work."
      />
      <Feedback error={error} message={message} />
      <Button
        title="Notifications & phone alerts"
        variant="secondary"
        icon="notifications-outline"
        onPress={() => router.push('/notifications')}
        style={{ marginBottom: 16 }}
      />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 21 }}>
          <View
            style={{
              height: 53,
              width: 53,
              borderRadius: 27,
              backgroundColor: colors.mint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="person-outline" size={27} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, color: colors.ink, fontWeight: '600' }}>{user.name}</Text>
            <Body>
              {user.role === 'owner'
                ? 'Outlet owner'
                : user.role === 'staff'
                  ? 'Outlet team'
                  : 'Personal account'}
            </Body>
          </View>
        </View>
        <Body>{user.email}</Body>
        <Body style={{ marginTop: 8 }}>
          {user.phone || 'Add your mobile number when booking a pickup.'}
        </Body>
        {user.emailVerified && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, alignItems: 'center' }}>
            <Icon name="shield-checkmark" size={17} />
            <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700' }}>
              Email verified
            </Text>
          </View>
        )}
        <Button
          title={editing ? 'Cancel edit' : 'Edit profile'}
          variant="secondary"
          onPress={() => {
            setEditing(!editing);
            setName(user.name);
            setPhone(user.phone);
          }}
          disabled={busy}
        />
        {editing && (
          <View style={{ marginTop: 16 }}>
            <Field label="Full name" value={name} onChangeText={setName} maxLength={80} />
            <Field
              label="Mobile number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Button
              title="Save profile"
              busy={busy}
              onPress={async () => {
                setBusy(true);
                setError(null);
                try {
                  await updateProfile({ name, phone });
                  setEditing(false);
                  setMessage('Profile updated.');
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        )}
      </Card>
      {user.role === 'customer' && (
        <Card>
          <SectionTitle>Work with the outlet</SectionTitle>
          <Body>
            {user.staffRequestStatus === 'declined'
              ? 'The owner declined your staff request. Contact the outlet if you need clarification.'
              : user.staffRequestedAt
                ? 'Your staff access request is awaiting owner review.'
                : 'Request staff access if you are part of the outlet team. The owner reviews every request.'}
          </Body>
          {!user.staffRequestedAt && (
            <Button
              title="Request staff access"
              variant="secondary"
              busy={busy}
              onPress={async () => {
                setBusy(true);
                setError(null);
                try {
                  await requestStaffAccess();
                  setMessage('Staff access requested. The owner will review it.');
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </Card>
      )}
      {user.role === 'staff' && (
        <Card>
          <SectionTitle>Your personal laundry</SectionTitle>
          <Body>Your staff account can also book and track your own pickups.</Body>
          <Button
            title="My personal orders"
            variant="secondary"
            onPress={() => router.push({ pathname: '/(tabs)/orders', params: { scope: 'mine' } })}
          />
        </Card>
      )}
      <Card>
        <SectionTitle>
          {user.role === 'owner' ? 'Owner inbox' : 'Questions for the owner'}
        </SectionTitle>
        <Body>
          {user.role === 'staff'
            ? 'Raise a private staff query or check replies from the owner.'
            : 'View your queries, responses and resolutions.'}
        </Body>
        <Button
          title="Open support"
          variant="secondary"
          onPress={() => router.push('/(tabs)/support')}
        />
      </Card>
      {(canOperate(user) || count > 0) && (
        <>
          <Card>
            <SectionTitle>Saved packing scans</SectionTitle>
            <Body>
              {count} scans waiting for server verification. Version conflicts stay here until you
              review the order.
            </Body>
            <Button
              title="Sync saved scans"
              disabled={!canOperate(user)}
              busy={busy}
              onPress={async () => {
                setBusy(true);
                setError(null);
                try {
                  const result = await syncPending(user.id);
                  setCount(pendingScans(user.id).length);
                  setError(result.error);
                  setMessage(`${result.sent} verified. ${result.remaining} remaining.`);
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            />
            {count > 0 && (
              <Button
                variant="secondary"
                disabled={busy}
                title="Discard saved scans"
                onPress={() =>
                  Alert.alert(
                    'Discard saved scans?',
                    'These scans have not been confirmed by the outlet. You will need to scan those garments again.',
                    [
                      { text: 'Keep scans', style: 'cancel' },
                      {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => {
                          clearPending(user.id);
                          setCount(0);
                          setMessage('Saved scans discarded. Scan the physical garments again.');
                        },
                      },
                    ],
                  )
                }
              />
            )}
          </Card>
          {canOperate(user) && <OutletSummary />}
        </>
      )}
      {user.role === 'owner' && (
        <Card>
          <SectionTitle>Order report</SectionTitle>
          <Body>Export booking values as CSV. These values do not record collected payments.</Body>
          <Button
            title="Save or share CSV"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await shareOrderExport();
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      )}
      <Card style={{ backgroundColor: colors.mint }}>
        <SectionTitle>Care, with a clear trail.</SectionTitle>
        <Body>
          LaundryTrack tracks custody, counted receipts, packing reconciliation and customer
          acknowledgement. QR labels need a physical wash-safe attachment tested by the outlet.
        </Body>
        <Body style={{ marginTop: 14, fontSize: 12 }}>Version 1.0</Body>
      </Card>
      <Button
        title="Sign out"
        variant="secondary"
        icon="log-out-outline"
        busy={busy}
        onPress={signOut}
      />
    </Screen>
  );
}
