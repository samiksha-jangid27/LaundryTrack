import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { TICKET_CATEGORIES, dateLabel } from '@laundrytrack/shared';
import { useResource } from '../../lib/hooks';
import { useSession } from '../../lib/session';
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
  Icon,
  colors,
  s,
} from '../../components/UI';
const labels = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };
export default function Support() {
  const { user } = useSession();
  const params = useLocalSearchParams();
  const { data, loading, error, offline, refreshing, reload } = useResource('/support');
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('other');
  const [linked, setLinked] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [scope, setScope] = useState(user.role === 'owner' ? 'all' : 'mine');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const requestId = useRef(Crypto.randomUUID());
  useEffect(() => {
    if (typeof params.orderId === 'string') {
      setLinked({ id: params.orderId, number: params.orderNumber || 'Selected order' });
      setFormOpen(true);
      router.setParams({ orderId: undefined, orderNumber: undefined });
    }
  }, [params.orderId, params.orderNumber]);
  const tickets = (data?.tickets || []).filter(
    (ticket) =>
      (status === 'all' || ticket.status === status) &&
      (scope === 'all' ||
        (scope === 'mine'
          ? ticket.requester_id === user.id
          : ticket.assigned_to === user.id && ticket.requester_id !== user.id)) &&
      `${ticket.subject} ${ticket.requester.name} ${ticket.category}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  async function create() {
    setBusy(true);
    setFailure(null);
    try {
      const result = await api('/support', {
        method: 'POST',
        body: {
          requestId: requestId.current,
          subject,
          message,
          category,
          ...(linked ? { orderId: linked.id } : {}),
        },
      });
      setFormOpen(false);
      setSubject('');
      setMessage('');
      setLinked(null);
      requestId.current = Crypto.randomUUID();
      await reload();
      router.push(`/support/${result.ticket.id}`);
    } catch (e) {
      setFailure(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Heading
        eyebrow={user.role === 'owner' ? 'Customer & team support' : 'We are here to help'}
        title="Queries & support"
        subtitle={
          user.role === 'staff'
            ? 'Raise private questions to the owner or handle customer queries assigned to you.'
            : user.role === 'owner'
              ? 'Review customer and staff queries, assign help and follow every response.'
              : 'Ask about an order, billing or your account. Follow replies here.'
        }
      />
      <Button
        title={formOpen ? 'Close query form' : 'Raise a query'}
        icon={formOpen ? 'close-outline' : 'chatbubble-ellipses-outline'}
        onPress={() => {
          setFormOpen(!formOpen);
          setFailure(null);
        }}
        disabled={busy}
        style={{ marginBottom: 18 }}
      />
      <Feedback error={failure} />
      {formOpen && (
        <Card>
          <Field
            label="Subject"
            placeholder="How can we help?"
            value={subject}
            onChangeText={setSubject}
            maxLength={120}
            editable={!busy}
          />
          <Body>Category</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 12 }}>
            {Object.entries(TICKET_CATEGORIES)
              .filter(([key]) => key !== 'operations' || user.role !== 'customer')
              .map(([key, label]) => (
                <Chip key={key} selected={key === category} onPress={() => setCategory(key)}>
                  {label}
                </Chip>
              ))}
          </View>
          {linked && (
            <View
              style={[
                s.row,
                { padding: 12, backgroundColor: colors.mint, borderRadius: 12, marginBottom: 16 },
              ]}
            >
              <Body>About {linked.number}</Body>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove order reference"
                onPress={() => setLinked(null)}
              >
                <Icon name="close-outline" />
              </Pressable>
            </View>
          )}
          <Field
            label="Your query"
            placeholder="Share enough detail so we can help."
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            editable={!busy}
          />
          {user.role === 'staff' && <Body>Your own query is private to you and the owner.</Body>}
          <Button
            title="Send to owner"
            busy={busy}
            onPress={create}
            disabled={subject.trim().length < 5 || message.trim().length < 10}
          />
        </Card>
      )}
      {user.role !== 'customer' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {(user.role === 'owner'
            ? [
                ['all', 'All queries'],
                ['mine', 'My queries'],
              ]
            : [
                ['mine', 'My queries'],
                ['assigned', 'Assigned to me'],
              ]
          ).map(([key, label]) => (
            <Chip key={key} selected={scope === key} onPress={() => setScope(key)}>
              {label}
            </Chip>
          ))}
        </View>
      )}
      <Field
        label="Search queries"
        icon="search-outline"
        value={search}
        onChangeText={setSearch}
        placeholder="Subject or name"
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
        {[['all', 'All'], ...Object.entries(labels)].map(([key, label]) => (
          <Chip key={key} selected={status === key} onPress={() => setStatus(key)}>
            {label}
          </Chip>
        ))}
      </View>
      <Feedback
        error={!offline && error}
        message={offline ? 'Saved queries. Connect and refresh to see the latest replies.' : null}
      />
      {loading ? (
        <Loading />
      ) : tickets.length ? (
        tickets.map((ticket) => (
          <Pressable
            key={ticket.id}
            accessibilityRole="button"
            onPress={() => router.push(`/support/${ticket.id}`)}
            style={{
              padding: 18,
              backgroundColor: 'white',
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 20,
              marginBottom: 12,
            }}
          >
            <View style={s.row}>
              <Text style={{ fontSize: 11, color: colors.green, fontWeight: '700' }}>
                {TICKET_CATEGORIES[ticket.category]}
              </Text>
              <Text
                style={{
                  color: ticket.status === 'resolved' ? colors.green : '#B16A25',
                  fontSize: 12,
                }}
              >
                {labels[ticket.status]}
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: colors.ink, fontWeight: '700', marginTop: 12 }}>
              {ticket.subject}
            </Text>
            <Body style={{ marginTop: 8 }}>
              {ticket.requester.name} · {ticket.requester_role}
              {ticket.assigned ? ` · Assigned: ${ticket.assigned.name}` : ' · Owner review'}
            </Body>
            <View style={[s.row, { marginTop: 12 }]}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Updated {dateLabel(ticket.updated_at)}
              </Text>
              <Icon name="chevron-forward" size={18} />
            </View>
          </Pressable>
        ))
      ) : (
        <Empty title="No matching queries">
          Your questions and outlet replies will appear here.
        </Empty>
      )}
    </Screen>
  );
}
