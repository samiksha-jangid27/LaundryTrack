import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useNotifications } from '../lib/notifications';
import { Icon, colors } from './UI';
export default function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Notifications, ${unread} unread`}
      onPress={() => router.push('/notifications')}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Icon name="notifications-outline" size={23} />
      {unread > 0 && (
        <View
          style={{
            position: 'absolute',
            right: -3,
            top: -4,
            backgroundColor: colors.coral,
            borderRadius: 10,
            paddingHorizontal: 5,
            minWidth: 19,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 10, lineHeight: 18, fontWeight: '800' }}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
