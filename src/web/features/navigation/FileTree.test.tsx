import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { treeFixture } from '../../test-support/fixtures';
import { FileTree } from './FileTree';
import { countNotes } from './tree-utils';

function renderTree(currentPath = 'domene/delt/Adresse') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
<MemoryRouter>
      <FileTree vaultId="test" root={treeFixture.root} currentPath={currentPath} />
    </MemoryRouter>
</QueryClientProvider>,
  );
}

describe('FileTree', () => {
  it('teller notater rekursivt', () => {
    expect(countNotes(treeFixture.root)).toBe(5);
  });

  it('viser mapper med antall og ekspanderer forfedrene til gjeldende notat', () => {
    renderTree();
    const domene = screen.getByRole('button', { name: /domene/ });
    expect(domene).toHaveAttribute('aria-expanded', 'true');
    expect(domene).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /delt/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /teknisk/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Callouts' })).toBeNull();
  });

  it('markerer gjeldende notat med aria-current', () => {
    renderTree();
    expect(screen.getByRole('link', { name: 'Adresse' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Kunde' })).not.toHaveAttribute('aria-current');
  });

  it('mapper kan åpnes og lukkes', () => {
    renderTree();
    const teknisk = screen.getByRole('button', { name: /teknisk/ });
    fireEvent.click(teknisk);
    expect(teknisk).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Callouts' })).toHaveAttribute('href', '/v/test/teknisk/Callouts');
    fireEvent.click(teknisk);
    expect(screen.queryByRole('link', { name: 'Callouts' })).toBeNull();
  });

  it('viser filer på rot, inkl. bases og dempede ikke-støttede filer', () => {
    renderTree();
    expect(screen.getByRole('link', { name: 'Oppgaver.base' })).toHaveAttribute('href', '/v/test/Oppgaver.base');
    expect(screen.getByRole('link', { name: 'Tegning.canvas' })).toHaveClass('dim');
  });
});
