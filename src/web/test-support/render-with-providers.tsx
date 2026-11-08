import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { ThemeProvider } from '../features/theme';
import { ViewSettingsProvider } from '../features/view-settings';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>;
}

export function renderWithProviders(
  node: ReactNode,
  { route = '/', client = createTestQueryClient() }: { route?: string; client?: QueryClient } = {},
) {
  const result = render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ViewSettingsProvider>
          <MemoryRouter initialEntries={[route]}>
            {node}
            <LocationProbe />
          </MemoryRouter>
        </ViewSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}
