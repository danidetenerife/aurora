import { render } from '@testing-library/react';

import type { QueueItem } from '@aurora/model';

import { AuroraJamQueueItem } from './AuroraJamQueueItem';

const makeItem = (overrides: Partial<QueueItem['track']> = {}): QueueItem => ({
  id: '1',
  status: 'success',
  addedAtIso: '2024-01-01T00:00:00.000Z',
  track: {
    title: 'Idioteque',
    artists: [{ name: 'Radiohead', roles: ['main'] }],
    artwork: {
      items: [
        {
          url: 'https://example.com/kid-a.jpg',
          purpose: 'thumbnail',
          width: 48,
          height: 48,
        },
      ],
    },
    durationMs: 251000,
    source: { provider: 'test', id: 'track-1' },
    ...overrides,
  },
});

describe('AuroraJamQueueItem', () => {
  it('(Snapshot) renders a current item with cover art', () => {
    const { container } = render(
      <AuroraJamQueueItem item={makeItem()} isCurrent={true} />,
    );
    expect(container).toMatchSnapshot();
  });

  it('(Snapshot) renders a non-current item without artwork', () => {
    const { container } = render(
      <AuroraJamQueueItem
        item={makeItem({ artwork: undefined })}
        isCurrent={false}
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it('(Snapshot) renders a remove button', () => {
    const { container } = render(
      <AuroraJamQueueItem
        item={makeItem()}
        isCurrent={false}
        onRemove={vi.fn()}
      />,
    );
    expect(container).toMatchSnapshot();
  });
});
