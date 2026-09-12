import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MobileCardPages } from './MobileCardPages';

const Wrapper = {
  mount() {
    render(
      <MobileCardPages
        items={[
          { id: 'first', title: 'First album' },
          { id: 'second', title: 'Second album' },
        ]}
        labels={{
          filterPlaceholder: 'Filter albums',
          nothingFound: 'No albums',
        }}
      />,
    );
  },
  get card() {
    return screen.getByTestId('mobile-dashboard-card');
  },
  async next() {
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
  },
  async filter(text: string) {
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Filter albums' }),
      text,
    );
  },
};

it('pages and filters albums without requiring a scrollable list', async () => {
  Wrapper.mount();
  expect(Wrapper.card).toHaveTextContent('First album');
  await Wrapper.next();
  expect(Wrapper.card).toHaveTextContent('Second album');
  await Wrapper.filter('First');
  expect(Wrapper.card).toHaveTextContent('First album');
});
