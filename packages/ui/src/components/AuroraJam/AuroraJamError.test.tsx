import { render } from '@testing-library/react';

import { AuroraJamError } from './AuroraJamError';

const labels = {
  title: 'Could not connect',
  subtitle: 'Make sure Aurora is running',
};

describe('AuroraJamError', () => {
  it('(Snapshot) renders with labels', () => {
    const { container } = render(<AuroraJamError labels={labels} />);
    expect(container).toMatchSnapshot();
  });
});
