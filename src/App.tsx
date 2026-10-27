import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout, PinGate } from './components/Layout';
import { ConfirmHost, ToastHost } from './components/ui';
import { useTheme } from './components/useTheme';
import { useStore } from './store/useStore';
import { useAdminSync } from './sync/useSync';
import Dashboard from './pages/Dashboard';
import TeamsPage from './pages/TeamsPage';
import DrawPage from './pages/DrawPage';
import MatchesPage from './pages/MatchesPage';
import StandingsPage from './pages/StandingsPage';
import KnockoutPage from './pages/KnockoutPage';
import StatsPage from './pages/StatsPage';
import TeamProfilePage from './pages/TeamProfilePage';
import LogPage from './pages/LogPage';
import SettingsPage from './pages/SettingsPage';
import PrintPage from './pages/PrintPage';
import PresentationPage from './pages/PresentationPage';
import LivePage from './pages/LivePage';
import RulesPage from './pages/RulesPage';
import MatchDisplayPage from './pages/MatchDisplayPage';
import { SyncAccountGate } from './components/SyncAccountGate';

function AdminArea() {
  useAdminSync();
  return (
    <PinGate>
      <Layout />
    </PinGate>
  );
}

function AdminTheme() {
  const settings = useStore((s) => s.t.settings);
  useTheme(settings);
  return null;
}

export const appRoutes = (
      <>
        <Route path="/" element={<LivePage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/show" element={<PresentationPage />} />
        <Route path="/match-display" element={<MatchDisplayPage />} />
        <Route
          path="admin"
          element={
            <>
              <AdminTheme />
              <SyncAccountGate><AdminArea /></SyncAccountGate>
            </>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="draw" element={<DrawPage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="standings" element={<StandingsPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="knockout" element={<KnockoutPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="team/:id" element={<TeamProfilePage />} />
          <Route path="log" element={<LogPage />} />
          <Route path="print" element={<PrintPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </>
);

export default function App() {
  return (
    <HashRouter>
      <Routes>{appRoutes}</Routes>
      <ConfirmHost />
      <ToastHost />
    </HashRouter>
  );
}
