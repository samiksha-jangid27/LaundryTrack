import { useState } from 'react';
import { View, Image, Text } from 'react-native';
import * as Print from 'expo-print';
import { tagPayload } from '@laundrytrack/shared';
import { api } from '../lib/api';
import { labelSheet } from '../lib/labels';
import { Card, SectionTitle, Body, Button, Feedback, colors } from './UI';

export default function GarmentLabels({ order }) {
  const [labels, setLabels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function load(print = false) {
    setBusy(true);
    setError(null);
    try {
      const result = await api(`/orders/${order.id}/labels`);
      setLabels(result.labels);
      if (print) await Print.printAsync({ html: labelSheet(order.number, result.labels) });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <SectionTitle>Garment QR labels</SectionTitle>
      <Body>
        Print one label per garment. Use wash-safe labels and check the attachment before
        processing.
      </Body>
      <Feedback error={error} />
      <Button title="Show QR labels" busy={busy} variant="secondary" onPress={() => load()} />
      <Button title="Print garment labels" busy={busy} onPress={() => load(true)} />
      {order.garments.map((garment) => {
        const label = labels.find((item) => item.id === garment.id);
        return (
          <View key={garment.id} style={{ marginTop: 18 }}>
            <Body>
              {garment.color} {garment.type}
            </Body>
            {label && (
              <Image
                accessibilityLabel={`QR label for ${garment.color} ${garment.type}`}
                source={{ uri: label.image }}
                style={{ width: 180, height: 180, alignSelf: 'center' }}
              />
            )}
            <Text selectable style={{ color: colors.green, fontSize: 11, marginTop: 8 }}>
              {tagPayload(garment.id)}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}
