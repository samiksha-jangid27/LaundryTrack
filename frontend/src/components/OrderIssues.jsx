import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, SectionTitle, Body, Field, Button, colors, s } from './UI';
export default function OrderIssues({ order, staff, act, busy }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('missing');
  const [message, setMessage] = useState('');
  const [resolutions, setResolutions] = useState({});
  return (
    <Card>
      <SectionTitle>A little help, if you need it</SectionTitle>
      <Body>Keep questions and resolutions with this order.</Body>
      {!staff && (
        <Button
          variant="secondary"
          title={open ? 'Close issue form' : 'Raise an issue'}
          onPress={() => setOpen(!open)}
        />
      )}
      {open && (
        <View style={{ marginTop: 22 }}>
          <Body>What’s this about?</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 13 }}>
            {['missing', 'damage', 'delay', 'billing', 'other'].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: value === category }}
                onPress={() => setCategory(value)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: category === value ? colors.green : colors.mint,
                }}
              >
                <Text style={{ fontSize: 12, color: category === value ? 'white' : colors.green }}>
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Tell us a little more"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
          />
          <Button
            title="Send to the outlet"
            busy={busy}
            onPress={async () => {
              if (await act('issues', { category, message })) {
                setOpen(false);
                setMessage('');
              }
            }}
          />
        </View>
      )}
      {order.issues.map((issue) => (
        <View
          key={issue.id}
          style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 19, marginTop: 20 }}
        >
          <View style={s.row}>
            <Text style={{ color: '#7b8d66', fontSize: 12, fontWeight: '600' }}>
              {issue.category.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 12, color: colors.green }}>{issue.status}</Text>
          </View>
          <Body style={{ marginVertical: 12, color: colors.ink }}>{issue.message}</Body>
          {issue.resolution && (
            <View style={{ padding: 14, backgroundColor: colors.mint, borderRadius: 10 }}>
              <Body>{issue.resolution}</Body>
            </View>
          )}
          {staff && issue.status === 'open' && (
            <>
              <Field
                label="Outlet response"
                value={resolutions[issue.id] || ''}
                onChangeText={(value) => setResolutions((v) => ({ ...v, [issue.id]: value }))}
                multiline
                maxLength={1000}
              />
              <Button
                title="Resolve issue"
                busy={busy}
                variant="secondary"
                onPress={() =>
                  act(`issues/${issue.id}/resolve`, { resolution: resolutions[issue.id] || '' })
                }
              />
            </>
          )}
        </View>
      ))}
    </Card>
  );
}
