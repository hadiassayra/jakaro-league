import { TournamentRules } from '../components/TournamentRules';
import { useStore } from '../store/useStore';

export default function RulesPage() {
  const settings = useStore(s => s.t.settings);
  return <TournamentRules settings={settings} />;
}
