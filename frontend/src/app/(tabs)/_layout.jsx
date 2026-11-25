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
        tabBarInactiveTintColor: '#98a38d',
        tabBarStyle: { backgroundColor: 'white', borderTopColor: '#e2e8d8' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color }) => <Icon name="grid-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: staff ? 'Workspace' : 'My orders',
          tabBarIcon: ({ color }) => <Icon name="bag-handle-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Book pickup',
          href: staff ? null : undefined,
          tabBarIcon: ({ color }) => <Icon name="add-circle-outline" color={color} />,
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
