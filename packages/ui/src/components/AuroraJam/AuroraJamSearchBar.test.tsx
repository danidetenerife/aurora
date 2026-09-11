import { render } from '@testing-library/react';

import { AuroraJamSearchBar } from './AuroraJamSearchBar';

const labels = {
  placeholder: 'Search for music',
};

describe('AuroraJamSearchBar', () => {
  it('(Snapshot) renders empty', () => {
    const { container } = render(
      <AuroraJamSearchBar value="" onChange={() => {}} labels={labels} />,
    );
    expect(container).toMatchSnapshot();
  });

  it('(Snapshot) renders with a value', () => {
    const { container } = render(
      <AuroraJamSearchBar
        value="Radiohead"
        onChange={() => {}}
        labels={labels}
      />,
    );
    expect(container).toMatchSnapshot();
  });
});
