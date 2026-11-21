import { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { canOperate, STAGE_LABELS } from '@laundrytrack/core';
import { useSession } from '../../lib/session';
import { getBaseUrl } from '../../lib/api';
import { pendingScans, syncPending } from '../../lib/queue';
import { clearLocal } from '../../lib/storage';
import { useResource } from '../../lib/hooks';
import {
  Screen,
  Heading,
  Card,
  SectionTitle,
  Body,
  Button,
  Feedback,
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
  const { user, logout, demo } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(pendingScans(user.id).length);
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
        subtitle="Your profile, connection and saved work."
      />
      <Feedback error={error} message={message} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 21 }}>
          <View
            style={{
              height: 53,
              width: 53,
              borderRadius: 27,
              backgroundColor: '#e9f1dc',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="person-outline" size={27} />
          </View>
          <View>
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
        <Body style={{ marginTop: 8 }}>{user.phone}</Body>
        {demo && (
          <Text style={{ fontSize: 11, letterSpacing: 1, color: '#93a177', marginTop: 22 }}>
            DEMO ACCOUNT · SYNTHETIC DATA
          </Text>
        )}
      </Card>
      {canOperate(user) && (
        <>
          <Card>
            <SectionTitle>Saved packing scans</SectionTitle>
            <Body>
              {count} scans waiting for server verification. Version conflicts stay here until you
              review the order.
            </Body>
            <Button
              title="Sync saved scans"
              busy={busy}
              onPress={async () => {
                setBusy(true);
                setError(null);
                const result = await syncPending(user.id);
                setCount(pendingScans(user.id).length);
                setError(result.error);
                setMessage(`${result.sent} verified. ${result.remaining} remaining.`);
                setBusy(false);
              }}
            />
            {count > 0 && (
              <Button
                variant="secondary"
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
                          clearLocal(user.id);
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
          <OutletSummary />
        </>
      )}
      <Card>
        <SectionTitle>API connection</SectionTitle>
        <Text selectable style={{ fontSize: 13, color: colors.green, lineHeight: 22 }}>
          {getBaseUrl()}
        </Text>
        <Body style={{ marginTop: 13 }}>
          To connect to another outlet server, sign out and use connection settings on the sign-in
          screen.
        </Body>
      </Card>
      <Card style={{ backgroundColor: '#edf3e4' }}>
        <SectionTitle>Care, with a clear trail.</SectionTitle>
        <Body>
          LaundryTrack tracks custody, counted receipts, packing reconciliation and customer
          acknowledgement. QR labels need a physical wash-safe attachment tested by the outlet.
        </Body>
        <Body style={{ marginTop: 14, fontSize: 12 }}>Version 1.0 · One-outlet project pilot</Body>
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
