import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { nextStage, STAGE_LABELS } from '@laundrytrack/core';
import { useResource } from '../lib/hooks';
import { Button, Card, SectionTitle, Body, Field, Icon, colors, s } from './UI';
export default function StaffControls({ order, act, busy, pending = 0, onError }) {
  const { data } = useResource('/outlet/staff');
  const [type, setType] = useState('');
  const [color, setColor] = useState('');
  const [note, setNote] = useState('');
  const [count, setCount] = useState(String(order.expected_count));
  const [selected, setSelected] = useState([]);
  const [code, setCode] = useState('');
  if (['cancelled', 'delivered'].includes(order.stage)) return null;
  const next = nextStage(order.stage);
  return (
    <Card>
      <SectionTitle>The next careful step.</SectionTitle>
      <Body>Assigned team member</Body>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8, marginBottom: 20 }}
      >
        {data?.staff.map((staff) => (
          <Pressable
            key={staff.id}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ selected: staff.id === order.assigned_to }}
            onPress={() => act('assign', { staffId: staff.id })}
            style={{
              padding: 11,
              borderRadius: 9,
              borderWidth: 1,
              borderColor: staff.id === order.assigned_to ? colors.green : colors.line,
              backgroundColor: staff.id === order.assigned_to ? '#eaf2df' : 'white',
            }}
          >
            <Text style={{ fontSize: 12, color: colors.green }}>{staff.name}</Text>
          </Pressable>
        ))}
      </View>
      {order.stage === 'booked' && (
        <>
          <Field
            label={`Count at pickup (${order.expected_count} expected)`}
            value={count}
            onChangeText={setCount}
            keyboardType="number-pad"
          />
          <Body>Resolve a mismatch with the customer before accepting custody.</Body>
          <Button
            busy={busy}
            title="Confirm counted pickup"
            onPress={() => act('collect', { count: Number(count) })}
          />
        </>
      )}
      {order.stage === 'collected' && (
        <>
          <Body>
            {order.garments.length} / {order.collected_count} garments registered. Add one label for
            each piece.
          </Body>
          {order.garments.length < order.collected_count && (
            <View style={{ marginTop: 19 }}>
              <Field
                label="Garment type"
                value={type}
                onChangeText={setType}
                placeholder="Shirt, trousers, kurta…"
                maxLength={50}
              />
              <Field label="Colour" value={color} onChangeText={setColor} maxLength={40} />
              <Field
                label="Existing marks / care note"
                value={note}
                onChangeText={setNote}
                maxLength={200}
              />
              <Button
                busy={busy}
                variant="secondary"
                title="Register garment"
                onPress={async () => {
                  if (await act('garments', { type, color, note })) {
                    setType('');
                    setColor('');
                    setNote('');
                  }
                }}
              />
            </View>
          )}
        </>
      )}
      {order.stage === 'packing' && (
        <>
          <Body>
            {order.garments.filter((g) => g.packed).length} / {order.garments.length} packed
            {pending ? ` · ${pending} scans waiting to sync` : ''}.
          </Body>
          <Button
            busy={busy}
            icon="scan-outline"
            title="Open QR scanner"
            onPress={() => router.push(`/scan/${order.id}`)}
          />
          {order.garments
            .filter((g) => g.packed)
            .map((g) => (
              <View
                key={g.id}
                style={{
                  marginTop: 15,
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                }}
              >
                <Body>
                  {g.color} {g.type}
                </Body>
                <Button
                  busy={busy}
                  variant="secondary"
                  title="Remove for recheck"
                  onPress={() => act('unpack', { garmentId: g.id })}
                />
              </View>
            ))}
        </>
      )}
      {next && !['collected', 'delivered'].includes(next) && (
        <Button
          busy={busy}
          disabled={pending > 0}
          title={`Mark ${STAGE_LABELS[next].toLowerCase()}`}
          onPress={() => act('advance')}
        />
      )}
      {order.stage === 'out_for_delivery' && (
        <View style={{ marginTop: 15 }}>
          <SectionTitle>Customer handoff</SectionTitle>
          <Body>
            Select only the pieces physically handed over. A partial return keeps the rest open.
          </Body>
          {order.garments
            .filter((g) => !g.delivered)
            .map((g) => (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected.includes(g.id) }}
                accessibilityLabel={`${g.color} ${g.type}`}
                key={g.id}
                onPress={() =>
                  setSelected((ids) =>
                    ids.includes(g.id) ? ids.filter((id) => id !== g.id) : [...ids, g.id],
                  )
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15 }}
              >
                <Icon name={selected.includes(g.id) ? 'checkbox' : 'square-outline'} />
                <Text style={{ fontSize: 14, color: colors.ink }}>
                  {g.color} {g.type}
                </Text>
              </Pressable>
            ))}
          <Field
            label="Customer’s 6-digit delivery code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button
            title={`Acknowledge ${selected.length} returned garments`}
            busy={busy}
            onPress={async () => {
              if (!selected.length) {
                onError(new Error('Select the garments being received.'));
                return;
              }
              if (await act('deliver', { code, garmentIds: selected })) {
                setSelected([]);
                setCode('');
              }
            }}
          />
        </View>
      )}
    </Card>
  );
}
