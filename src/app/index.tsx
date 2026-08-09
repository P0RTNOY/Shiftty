import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function IndexScreen() {
  const db = useSQLiteContext();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const result = await db.getFirstAsync<{ value_json: string }>(
          "SELECT value_json FROM app_settings WHERE key = 'onboarding_completed'"
        );
        if (result && result.value_json === '"true"') {
          setInitialRoute('/(tabs)');
        } else {
          setInitialRoute('/onboarding');
        }
      } catch {
        // Fallback to onboarding if table is somehow not ready
        setInitialRoute('/onboarding');
      }
    }
    checkOnboarding();
  }, [db]);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={initialRoute as any} />;
}
