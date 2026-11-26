import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, Icon, colors } from './UI';

export default function LaunchScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bubble} />
      <View
        style={[
          styles.bubble,
          { width: 220, height: 220, bottom: -60, left: -80, top: undefined, right: undefined },
        ]}
      />
      <View style={styles.center}>
        <View style={styles.mark}>
          <Icon name="shirt-outline" size={68} color={colors.green} />
        </View>
        <Brand light />
        <Text style={styles.tagline}>Fresh care. Right at your door.</Text>
        <ActivityIndicator color={colors.lime} style={{ marginTop: 32 }} />
      </View>
      <Text style={styles.footer}>PICKUP · CARE · TRACK · DELIVER</Text>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: { alignItems: 'center', gap: 14 },
  mark: {
    width: 124,
    height: 124,
    borderRadius: 38,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    transform: [{ rotate: '-8deg' }],
  },
  tagline: { color: '#D6F5ED', fontSize: 15, marginTop: 3 },
  bubble: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 160,
    top: -100,
    right: -140,
    backgroundColor: '#14948A',
  },
  footer: {
    position: 'absolute',
    bottom: 42,
    color: '#C8E9DF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.1,
  },
});
