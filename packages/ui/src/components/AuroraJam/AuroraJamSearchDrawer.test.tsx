import { render } from '@testing-library/react';

import { AuroraJamSearchDrawer } from './AuroraJamSearchDrawer';
import { AuroraJamSearchDrawerEmpty } from './AuroraJamSearchDrawerEmpty';
import { AuroraJamSearchDrawerError } from './AuroraJamSearchDrawerError';
import { AuroraJamSearchDrawerResults } from './AuroraJamSearchDrawerResults';

describe('AuroraJamSearchDrawer', () => {
  it('(Snapshot) renders nothing when closed', () => {
    const { container } = render(
      <AuroraJamSearchDrawer open={false}>
        <div>Hidden content</div>
      </AuroraJamSearchDrawer>,
    );
    expect(container).toMatchSnapshot();
  });

  it('(Snapshot) renders the sheet and backdrop with results', () => {
    const { container } = render(
      <AuroraJamSearchDrawer open>
        <AuroraJamSearchDrawerResults>
          <div>First result</div>
          <div>Second result</div>
        </AuroraJamSearchDrawerResults>
      </AuroraJamSearchDrawer>,
    );
    expect(container).toMatchSnapshot();
  });

  it('(Snapshot) renders the empty state', () => {
    const { container } = render(
      <AuroraJamSearchDrawer open>
        <AuroraJamSearchDrawerEmpty
          labels={{
            title: 'No results',
            description: 'Try a different search',
          }}
        />
      </AuroraJamSearchDrawer>,
    );
    expect(container).toMatchSnapshot();
  });

  it('(Snapshot) renders the error state', () => {
    const { container } = render(
      <AuroraJamSearchDrawer open>
        <AuroraJamSearchDrawerError
          labels={{
            title: 'Search failed',
            description: 'Check the player and try again',
          }}
        />
      </AuroraJamSearchDrawer>,
    );
    expect(container).toMatchSnapshot();
  });
});
