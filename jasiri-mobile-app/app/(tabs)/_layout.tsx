import { Tabs } from 'expo-router';
import { Home, Users, UserPlus, BarChart2 } from 'lucide-react-native';
import { View } from 'react-native';

function TabIcon({ icon: Icon, focused }: { icon: any; focused: boolean }) {
  return (
    <View className={`items-center justify-center w-12 h-12 rounded-2xl ${focused ? 'bg-primary' : 'bg-transparent'}`}>
      <Icon size={22} color={focused ? '#FFFFFF' : '#9CA3AF'} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#1E3A8A',
          shadowOpacity: 0.1,
          shadowRadius: 20,
          height: 70,
          paddingBottom: 10,
          paddingTop: 5,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={Home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={Users} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="new-customer"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="w-14 h-14 bg-accent rounded-2xl items-center justify-center shadow-lg" style={{ marginBottom: 20 }}>
              <UserPlus size={26} color="#FFFFFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={BarChart2} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
