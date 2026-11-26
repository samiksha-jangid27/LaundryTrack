import { useState } from 'react';
import { View, Text, Pressable, Linking, AppState } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSession } from '../lib/session';
import { useNotifications } from '../lib/notifications';
import { useResource } from '../lib/hooks';
import { api } from '../lib/api';
import { syncPushDevice } from '../lib/push';
import {
  Screen,
  Heading,
  Card,
  Body,
  Button,
  Feedback,
  Loading,
  Empty,
  Chip,
  Icon,
  colors,
  s,
} from '../components/UI';

export default function Notifications() {
  const { user } = useSession();
  const { unread, pushEnabled, refresh, open } = useNotifications();
  const [filter, setFilter] = useState('all');
  const inbox = useResource(`/notifications?filter=${filter}`);
  const reloadInbox = inbox.reload;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const reload = useCallback(() => {
    reloadInbox();
    refresh().catch(() => {});
  }, [reloadInbox, refresh]);
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') reload();
      }, 30000);
      return () => clearInterval(timer);
    }, [reload]),
  );
  async function action(operation) {
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await operation();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!user) return <Redirect href="/" />;
  const rows = inbox.data?.notifications || [];
  return (
    <Screen refreshing={inbox.refreshing} onRefresh={reload}>
      <Heading
        eyebrow="Stay in the loop"
        title="Your updates."
        subtitle={`${unread} unread · Orders, queries and account updates, all together.`}
      />
      <Card style={{ backgroundColor: colors.mint }}>
        <View style={s.row}>
          <Icon name="notifications-circle-outline" size={34} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16 }}>
              Never miss a fresh update
            </Text>
            <Body>Get alerts on your phone, even when the app is closed.</Body>
          </View>
        </View>
        <Button
          title={pushEnabled ? 'Enable alerts on this phone' : 'Turn phone alerts back on'}
          busy={busy}
          icon="notifications-outline"
          onPress={() =>
            action(async () => {
              await syncPushDevice(true);
              await api('/notifications/preferences', {
                method: 'PATCH',
                body: { pushEnabled: true },
              });
              await refresh();
              setMessage('Phone alerts are enabled.');
            })
          }
        />
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {pushEnabled && (
            <Button
              title="Pause phone alerts"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                action(async () => {
                  await api('/notifications/preferences', {
                    method: 'PATCH',
                    body: { pushEnabled: false },
                  });
                  await refresh();
                  setMessage('Phone alerts paused for your account. Updates still appear here.');
                })
              }
            />
          )}
          <Button
            title="Phone settings"
            variant="secondary"
            onPress={() => Linking.openSettings().catch(setError)}
          />
        </View>
      </Card>
      <Feedback
        error={error || (!inbox.offline && inbox.error)}
        message={
          message || (inbox.offline ? 'Showing saved updates. Connect to mark them read.' : '')
        }
      />
      <View style={[s.row, { marginBottom: 18, flexWrap: 'wrap' }]}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip selected={filter === 'all'} onPress={() => setFilter('all')}>
            All updates
          </Chip>
          <Chip selected={filter === 'unread'} onPress={() => setFilter('unread')}>
            Unread
          </Chip>
        </View>
        {!!unread && !!rows.length && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              action(async () => {
                await api('/notifications/read-all', {
                  method: 'PATCH',
                  body: { through: rows[0].created_at },
                });
                reload();
              })
            }
          >
            <Text style={{ color: colors.green, fontWeight: '700', paddingVertical: 10 }}>
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>
      {inbox.loading ? (
        <Loading />
      ) : !rows.length ? (
        <Empty title={filter === 'unread' ? 'You’re all caught up' : 'Your updates start here'}>
          {filter === 'unread'
            ? 'No unread notifications. We’ll keep you posted.'
            : 'Pickup progress, support replies and account updates will appear here.'}
        </Empty>
      ) : (
        rows.map((row) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`${row.read_at ? '' : 'Unread. '}${row.title}. ${row.body}`}
            disabled={busy}
            onPress={() =>
              action(async () => {
                await open(row.id);
                inbox.reload();
              })
            }
          >
            <Card
              style={{
                borderColor: row.read_at ? colors.line : '#A9DED1',
                backgroundColor: row.read_at ? 'white' : '#EDFAF5',
                padding: 17,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: row.category === 'support' ? '#EFEBFF' : colors.mint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={
                      row.category === 'support'
                        ? 'chatbubbles-outline'
                        : row.category === 'account'
                          ? 'person-circle-outline'
                          : 'bag-check-outline'
                    }
                    color={row.category === 'support' ? colors.purple : colors.green}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.row}>
                    <Text style={{ flex: 1, color: colors.ink, fontWeight: '800', fontSize: 15 }}>
                      {row.title}
                    </Text>
                    {!row.read_at && (
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: colors.coral,
                        }}
                      />
                    )}
                  </View>
                  <Body style={{ fontSize: 12, marginTop: 5, lineHeight: 19 }}>{row.body}</Body>
                  <Text style={{ fontSize: 10, color: colors.muted, marginTop: 10 }}>
                    {new Date(row.created_at).toLocaleString([], {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      )}
      {inbox.data?.nextCursor && (
        <Button
          title="Earlier updates"
          variant="secondary"
          busy={busy}
          onPress={() =>
            action(async () => {
              const page = await api(
                `/notifications?filter=${filter}&before=${inbox.data.nextCursor}`,
              );
              inbox.setData({
                notifications: [...rows, ...page.notifications],
                nextCursor: page.nextCursor,
              });
            })
          }
        />
      )}
    </Screen>
  );
}
