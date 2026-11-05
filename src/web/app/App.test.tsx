import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('viser produktnavnet', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Vault-leser' })).toBeInTheDocument();
  });
});
