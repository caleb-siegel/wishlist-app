import { Redirect } from 'expo-router';
import { useAuth } from '@/context/auth';

export default function Index() {
  const { user } = useAuth();

  if (user) {
    return <Redirect href="/(app)/(tabs)/my-list" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
