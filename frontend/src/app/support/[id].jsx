import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { TICKET_CATEGORIES, dateLabel } from '@laundrytrack/shared';
import { useResource } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { api } from '../../lib/api';
import { cacheGet, cacheSet } from '../../lib/storage';
import { createRetryRequest } from '../../lib/retry';
import {
  Screen,
  Heading,
  Card,
  Body,
  Button,
  Field,
  Feedback,
  Chip,
  Loading,
  colors,
  s,
} from '../../components/UI';
function OwnerAssignment({ ticket, act, busy }) {
  const { data } = useResource('/outlet/staff');
  return (
    <Card>
      <Text style={{ color: colors.ink, fontWeight: '700', marginBottom: 10 }}>
        Assign this query
      </Text>
      <Body>
        {ticket.requester_role === 'customer'
          ? 'Choose an active team member to handle this customer.'
          : 'Staff queries stay private to the owner.'}
      </Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {data?.staff
          .filter((person) => ticket.requester_role === 'customer' || person.role === 'owner')
          .map((person) => (
            <Chip
              key={person.id}
              selected={ticket.assigned_to === person.id}
              onPress={() => !busy && act({ assignedTo: person.id })}
            >
              {person.name}
            </Chip>
          ))}
      </View>
      {ticket.assigned_to && (
        <Button
          title="Remove assignment"
          variant="secondary"
          disabled={busy}
          onPress={() => act({ assignedTo: null })}
        />
      )}
    </Card>
  );
}
export default function QueryDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useSession();
  const { data, setData, loading, error, offline, refreshing, reload } = useResource(
    `/support/${id}`,
  );
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const retry = useMemo(() => {
    const key = `${user?.id}:support-action.${id}`;
    return createRetryRequest(Crypto.randomUUID, {
      load: () => cacheGet(key),
      save: (value) => cacheSet(key, value),
    });
  }, [id, user?.id]);
  async function act(values, reply = false) {
    if (busy || !data) return;
    setBusy(true);
    setFailure(null);
    try {
      const result = await api(`/support/${id}${reply ? '/messages' : ''}`, {
        method: reply ? 'POST' : 'PATCH',
        body: retry.prepare(JSON.stringify({ id, values, reply }), {
          version: data.ticket.version,
          ...values,
        }),
      });
      retry.clear();
      setData(result);
      if (reply) setMessage('');
    } catch (e) {
      setFailure(e);
      if (!e.offline && e.status && e.status < 500) retry.clear();
      if (e.status === 409) await reload();
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (!data)
    return (
      <Screen>
        <Feedback error={error} />
        <Button title="Try again" onPress={reload} />
      </Screen>
    );
  const ticket = data.ticket;
  const requester = ticket.requester_id === user.id;
  const operator = user.role === 'owner' || (!requester && ticket.assigned_to === user.id);
  const disabled = busy || offline;
  return (
    <Screen edges={['bottom']} refreshing={refreshing} onRefresh={reload}>
      <Heading
        eyebrow={TICKET_CATEGORIES[ticket.category]}
        title={ticket.subject}
        subtitle={`${ticket.requester.name} · ${ticket.requester_role} · ${dateLabel(ticket.created_at)}`}
      />
      <Feedback
        error={failure || (!offline && error)}
        message={offline ? 'Saved conversation. Reconnect before replying.' : null}
      />
      <Card>
        <View style={s.row}>
          <Text style={{ color: colors.green, fontWeight: '700' }}>
            {ticket.status.replaceAll('_', ' ').toUpperCase()}
          </Text>
          <Body>{ticket.assigned?.name || 'Awaiting owner review'}</Body>
        </View>
        {ticket.order &&
          (ticket.canViewOrder ? (
            <Button
              title={`View ${ticket.order.number}`}
              variant="secondary"
              onPress={() => router.push(`/order/${ticket.order.id}`)}
            />
          ) : (
            <Body style={{ marginTop: 12 }}>About {ticket.order.number}</Body>
          ))}
      </Card>
      {user.role === 'owner' && <OwnerAssignment ticket={ticket} act={act} busy={disabled} />}
      {ticket.olderMessages && <Body>Showing the latest 200 messages.</Body>}
      {ticket.messages.map((entry) =>
        entry.kind === 'system' ? (
          <Text
            key={entry.id}
            style={{ color: colors.muted, fontSize: 11, textAlign: 'center', marginVertical: 10 }}
          >
            {entry.author.name} · {entry.body}
          </Text>
        ) : (
          <View
            key={entry.id}
            style={{
              alignSelf: entry.author_id === user.id ? 'flex-end' : 'flex-start',
              maxWidth: '92%',
              backgroundColor: entry.author_id === user.id ? colors.mint : 'white',
              padding: 15,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.line,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.green, fontWeight: '700', marginBottom: 7 }}>
              {entry.author.name} · {entry.author_role}
            </Text>
            <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 22 }}>{entry.body}</Text>
            <Text style={{ fontSize: 10, color: colors.muted, marginTop: 9 }}>
              {new Date(entry.created_at).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        ),
      )}
      <Card style={{ marginTop: 10 }}>
        <Field
          label="Reply"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={2000}
          editable={!disabled}
          placeholder="Write your reply…"
        />
        <Button
          title={
            ticket.status === 'resolved' && (requester || user.role === 'owner')
              ? 'Reply & reopen'
              : 'Send reply'
          }
          disabled={
            disabled ||
            !message.trim() ||
            (ticket.status === 'resolved' && !requester && user.role !== 'owner')
          }
          busy={busy}
          onPress={() => act({ message }, true)}
        />
        {operator && ticket.status === 'open' && (
          <Button
            title="Mark in progress"
            variant="secondary"
            disabled={disabled}
            onPress={() => act({ status: 'in_progress' })}
          />
        )}
        {(operator || requester) && (
          <Button
            title={ticket.status === 'resolved' ? 'Reopen query' : 'Mark resolved'}
            variant="secondary"
            disabled={disabled}
            onPress={() => act({ status: ticket.status === 'resolved' ? 'open' : 'resolved' })}
          />
        )}
      </Card>
    </Screen>
  );
}
