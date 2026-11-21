import * as Crypto from 'expo-crypto';
import { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router, Redirect } from 'expo-router';
import { money, canOperate } from '@laundrytrack/core';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/hooks';
import { api } from '../../lib/api';
import { cacheSet } from '../../lib/storage';
import {
  Screen,
  Heading,
  Card,
  SectionTitle,
  Body,
  Button,
  Field,
  Feedback,
  Icon,
  Loading,
  colors,
  s,
} from '../../components/UI';
export default function Book() {
  const { user } = useSession();
  const { data, error, loading } = useResource('/services');
  const [quantities, setQuantities] = useState({});
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(user.phone);
  const [pickupDate, setDate] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  );
  const [slot, setSlot] = useState('09:00–12:00');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const [created, setCreated] = useState(null);
  const requestRef = useRef(null);
  if (canOperate(user)) return <Redirect href="/(tabs)/home" />;
  const services = data?.services || [];
  const count = Object.values(quantities).reduce((n, q) => n + q, 0);
  const total = services.reduce(
    (n, service) => n + service.price * (quantities[service.id] || 0),
    0,
  );
  const days = Array.from({ length: 15 }, (_, i) =>
    new Date(Date.now() + i * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  );
  async function submit() {
    setFailure(null);
    setBusy(true);
    try {
      const signature = JSON.stringify({ address, phone, pickupDate, slot, notes, quantities });
      if (requestRef.current?.signature !== signature)
        requestRef.current = { signature, id: Crypto.randomUUID() };
      const { order } = await api('/orders', {
        method: 'POST',
        body: {
          requestId: requestRef.current.id,
          address,
          phone,
          pickupDate,
          slot,
          notes,
          items: services
            .filter((service) => quantities[service.id])
            .map((service) => ({ serviceId: service.id, quantity: quantities[service.id] })),
        },
      });
      cacheSet(`${user.id}:delivery.${order.id}`, order.deliveryCode);
      setCreated(order);
    } catch (e) {
      setFailure(e);
    } finally {
      setBusy(false);
    }
  }
  if (created)
    return (
      <Screen>
        <View style={{ alignItems: 'center', paddingVertical: 35 }}>
          <Icon name="checkmark-circle-outline" size={74} />
          <Heading
            eyebrow="Your fresh start is booked"
            title="We’ll take it from here."
            subtitle={`${created.number} · ${created.expected_count} garments · ${money(created.total)}`}
          />
          <Card style={{ backgroundColor: '#e9f2dc', width: '100%' }}>
            <Body>Your private delivery code</Body>
            <Text
              style={{
                fontSize: 37,
                fontWeight: '700',
                letterSpacing: 7,
                color: colors.green,
                marginVertical: 18,
              }}
            >
              {created.deliveryCode}
            </Text>
            <Body>Share this with the delivery partner only when receiving your clothes.</Body>
          </Card>
          <Button
            title="View your care journey"
            onPress={() => {
              const id = created.id;
              setCreated(null);
              setQuantities({});
              router.push(`/order/${id}`);
            }}
          />
        </View>
      </Screen>
    );
  return (
    <Screen>
      <Heading
        eyebrow="Make some room in your day"
        title="Let’s take a load off."
        subtitle="Choose your care and a pickup window. We’ll handle the rest."
      />
      <Feedback error={failure || error} />
      {loading ? (
        <Loading />
      ) : (
        <>
          <Card>
            <SectionTitle>What’s in your laundry bag?</SectionTitle>
            <Body>All services are priced per garment.</Body>
            {services.map((service) => (
              <View
                key={service.id}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                  marginTop: 20,
                  paddingTop: 20,
                }}
              >
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>
                      {service.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#82936c', marginTop: 8 }}>
                      {money(service.price)} / item · {service.hours}h
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${service.name} item`}
                      disabled={!quantities[service.id]}
                      onPress={() =>
                        setQuantities((q) => ({
                          ...q,
                          [service.id]: Math.max(0, (q[service.id] || 0) - 1),
                        }))
                      }
                      style={{ padding: 9, backgroundColor: '#f0f5e8', borderRadius: 9 }}
                    >
                      <Icon name="remove" size={19} />
                    </Pressable>
                    <Text style={{ fontSize: 16, color: colors.ink }}>
                      {quantities[service.id] || 0}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${service.name} item`}
                      disabled={quantities[service.id] >= 30}
                      onPress={() =>
                        setQuantities((q) => ({ ...q, [service.id]: (q[service.id] || 0) + 1 }))
                      }
                      style={{ padding: 9, backgroundColor: '#f0f5e8', borderRadius: 9 }}
                    >
                      <Icon name="add" size={19} />
                    </Pressable>
                  </View>
                </View>
                <Body style={{ marginTop: 11, fontSize: 13 }}>{service.description}</Body>
              </View>
            ))}
          </Card>
          <Card>
            <SectionTitle>Your doorstep details</SectionTitle>
            <Field
              label="Pickup & delivery address"
              value={address}
              onChangeText={setAddress}
              multiline
              maxLength={350}
              placeholder="House / flat, street, locality and PIN code"
            />
            <Field
              label="Mobile number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Text style={s.label}>Pickup date</Text>
            <ScrollView
              horizontal
              contentContainerStyle={{ gap: 9, paddingBottom: 20 }}
              showsHorizontalScrollIndicator={false}
            >
              {days.map((day) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: day === pickupDate }}
                  key={day}
                  onPress={() => setDate(day)}
                  style={{
                    padding: 13,
                    borderRadius: 10,
                    backgroundColor: day === pickupDate ? colors.green : '#f1f5e9',
                  }}
                >
                  <Text
                    style={{ fontSize: 12, color: day === pickupDate ? 'white' : colors.green }}
                  >
                    {new Date(day + 'T12:00:00').toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={s.label}>Pickup window</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 23 }}>
              {['09:00–12:00', '12:00–15:00', '15:00–18:00'].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: slot === value }}
                  onPress={() => setSlot(value)}
                  style={{
                    padding: 11,
                    borderWidth: 1,
                    borderColor: slot === value ? colors.green : colors.line,
                    borderRadius: 9,
                    backgroundColor: slot === value ? '#e6efda' : 'white',
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.green }}>{value}</Text>
                </Pressable>
              ))}
            </View>
            <Field
              label="Care notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={500}
              placeholder="Any delicate fabric or existing marks?"
            />
          </Card>
          <Card>
            <View style={s.row}>
              <SectionTitle>Estimated total</SectionTitle>
              <Text style={{ fontSize: 27, color: colors.ink, fontWeight: '600' }}>
                {money(total)}
              </Text>
            </View>
            <Body>{count} garments · No delivery charge in this pilot.</Body>
            <Body style={{ marginTop: 14, fontSize: 12 }}>
              Payment is settled directly with the outlet. Any care exception is discussed before
              processing.
            </Body>
            <Button busy={busy} disabled={!count} title="Confirm pickup" onPress={submit} />
          </Card>
        </>
      )}
    </Screen>
  );
}
