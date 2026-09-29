import AuthPanel from '../components/AuthPanel';
import { useAuthFlow, type AuthMode } from '../hooks/useAuthFlow';

export default function AuthScreen({ initialMode = 'login' }: { initialMode?: AuthMode }) {
  const model = useAuthFlow(initialMode);
  return <AuthPanel model={model} />;
}
