import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { STAGE_LABELS } from '@laundrytrack/shared';
export const colors = {
  ink: '#132C3A',
  green: '#007F75',
  muted: '#667987',
  lime: '#D4F87A',
  bg: '#F4F7FB',
  line: '#E3EAF0',
  mint: '#E0F6F1',
  coral: '#FF765D',
  purple: '#7861D6',
};
export function Icon({ name, size = 22, color = colors.green }) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
export function Brand({ light = false, small = false }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: small ? 36 : 44,
          height: small ? 36 : 44,
          borderRadius: 14,
          backgroundColor: light ? colors.lime : colors.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name="shirt-outline"
          size={small ? 21 : 26}
          color={light ? colors.green : colors.lime}
        />
      </View>
      <Text
        style={{
          fontSize: small ? 21 : 25,
          fontWeight: '800',
          letterSpacing: -0.8,
          color: light ? 'white' : colors.ink,
        }}
      >
        Laundry<Text style={{ fontWeight: '400' }}>Track</Text>
      </Text>
    </View>
  );
}
export function Screen({ children, refreshing = false, onRefresh, edges = ['top'], style }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.screen, style]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.green}
                colors={[colors.green]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({ eyebrow, title, subtitle }) {
  return (
    <View style={s.heading}>
      {eyebrow && <Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text>}
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}
export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function SectionTitle({ children }) {
  return (
    <Text accessibilityRole="header" style={s.sectionTitle}>
      {children}
    </Text>
  );
}
export function Body({ children, style }) {
  return <Text style={[s.body, style]}>{children}</Text>;
}
export function Button({ title, onPress, busy, disabled, variant, icon, style }) {
  const alt = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        alt && s.secondary,
        pressed && { opacity: 0.82 },
        (disabled || busy) && { opacity: 0.55 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={alt ? colors.green : 'white'} />
      ) : icon ? (
        <Icon name={icon} size={20} color={alt ? colors.green : 'white'} />
      ) : null}
      <Text style={[s.buttonText, alt && { color: colors.green }]}>{title}</Text>
    </Pressable>
  );
}
export function Field({ label, error, icon, trailing, compact = false, style, ...props }) {
  return (
    <View style={{ marginBottom: compact ? 12 : 18 }}>
      <Text style={[s.label, compact && { marginBottom: 6, fontSize: 12 }]}>{label}</Text>
      <View
        style={[
          s.inputWrap,
          compact && { minHeight: 46 },
          props.multiline && { alignItems: 'flex-start' },
        ]}
      >
        {icon && (
          <View style={{ marginLeft: 13 }}>
            <Icon name={icon} size={19} color={colors.muted} />
          </View>
        )}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#91A2AE"
          style={[
            s.input,
            compact && { minHeight: 44, paddingVertical: 10 },
            props.multiline && { height: 90, textAlignVertical: 'top' },
            style,
          ]}
          {...props}
        />
        {trailing}
      </View>
      {error && <Text style={{ color: '#B54735', fontSize: 12, marginTop: 5 }}>{error}</Text>}
    </View>
  );
}
export function Chip({ children, selected, onPress, icon, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        s.chip,
        selected && { backgroundColor: colors.green, borderColor: colors.green },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={16} color={selected ? 'white' : colors.muted} />}
      <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? 'white' : colors.muted }}>
        {children}
      </Text>
    </Pressable>
  );
}
const badgeColors = {
  booked: ['#FFF1E7', '#A85E21'],
  collected: ['#EAF1FF', '#476BC2'],
  received: ['#EAF1FF', '#476BC2'],
  cleaning: ['#EEEAFE', '#7761C7'],
  quality_check: ['#EEEAFE', '#7761C7'],
  packing: ['#FFF1E7', '#A85E21'],
  ready: ['#DFF5ED', '#15745C'],
  out_for_delivery: ['#DFF5ED', '#15745C'],
  delivered: ['#DFF5ED', '#15745C'],
  cancelled: ['#FDEAE7', '#AA4E40'],
};
export function Badge({ stage }) {
  const [backgroundColor, color] = badgeColors[stage] || [colors.bg, colors.muted];
  return (
    <View style={[s.badge, { backgroundColor }]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{STAGE_LABELS[stage] || stage}</Text>
    </View>
  );
}
export function Feedback({ error, message }) {
  return error || message ? (
    <View
      accessibilityLiveRegion="polite"
      style={[s.feedback, error && { backgroundColor: '#FFF0EB', borderColor: '#F6D9CE' }]}
    >
      <Icon
        name={error ? 'alert-circle-outline' : 'checkmark-circle-outline'}
        size={20}
        color={error ? '#B54735' : colors.green}
      />
      <Text
        style={{ flex: 1, fontSize: 13, color: error ? '#B54735' : colors.green, lineHeight: 19 }}
      >
        {error?.message || error || message}
      </Text>
    </View>
  ) : null;
}
export function Loading() {
  return (
    <View
      style={{
        padding: 38,
        minHeight: 160,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 13,
      }}
    >
      <ActivityIndicator color={colors.green} />
      <Body>Loading your fresh updates…</Body>
    </View>
  );
}
export function Empty({ title, children }) {
  return (
    <View
      style={{
        alignItems: 'center',
        padding: 28,
        gap: 12,
        backgroundColor: 'white',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <View style={{ padding: 18, borderRadius: 24, backgroundColor: colors.mint }}>
        <Icon name="bag-check-outline" size={32} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, textAlign: 'center' }}>
        {title}
      </Text>
      <Body style={{ textAlign: 'center' }}>{children}</Body>
    </View>
  );
}
export const s = StyleSheet.create({
  screen: {
    padding: 20,
    paddingBottom: 32,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  heading: { marginTop: 18, marginBottom: 22 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.7,
    color: colors.green,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: colors.ink,
  },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 8 },
  card: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.ink,
    marginBottom: 12,
  },
  body: { fontSize: 14, color: colors.muted, lineHeight: 22 },
  button: {
    minHeight: 50,
    padding: 13,
    borderRadius: 15,
    backgroundColor: colors.green,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    marginTop: 8,
  },
  buttonText: { fontSize: 14, fontWeight: '700', color: 'white' },
  secondary: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.line },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDE6EB',
    borderRadius: 14,
    minHeight: 50,
    backgroundColor: '#F8FAFC',
  },
  input: { flex: 1, minWidth: 0, minHeight: 48, padding: 13, color: colors.ink, fontSize: 15 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.line,
  },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
  feedback: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#CDE9DF',
    backgroundColor: '#EAF8F2',
    marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 18 },
});
