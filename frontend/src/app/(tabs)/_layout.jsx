import { Tabs, Redirect } from 'expo-router';
import { canOperate } from '@laundrytrack/shared';
import { useSession } from '../../lib/session';
import { Icon, Loading, colors } from '../../components/UI';
export default function TabLayout() {
  const { user, loading } = useSession();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/" />;
  const staff = canOperate(user);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: '#8497A4',
        tabBarStyle: { backgroundColor: 'white', borderTopColor: colors.line, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: staff ? 'Dashboard' : 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: staff ? 'Requests' : 'My orders',
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? 'bag-handle' : 'bag-handle-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Book pickup',
          href: user.role === 'owner' ? null : undefined,
          tabBarIcon: ({ color }) => <Icon name="add-circle-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: 'Manage',
          href: user.role === 'owner' ? undefined : null,
          tabBarIcon: ({ color }) => <Icon name="people-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ color }) => <Icon name="chatbubbles-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <Icon name="person-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
