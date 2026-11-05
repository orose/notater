import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { useVaults } from '../shared/api';
import { ThemeProvider } from '../features/theme';
import { VaultLayout } from './VaultLayout';

function RootRedirect() {
  const { data, isError } = useVaults();
  if (isError) {
    return (
      <main className="page standalone" id="innhold">
        <div className="mini-state error-state" role="alert">
          <strong>Får ikke kontakt med serveren</strong>
          Start appen på nytt med <code>npm start</code> og last siden igjen.
        </div>
      </main>
    );
  }
  if (!data) return null;
  return <Navigate to={`/v/${encodeURIComponent(data.defaultVaultId)}`} replace />;
}

export function App() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/v/:vaultId/*" element={<VaultLayout />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
