import { render } from '@testing-library/react';

import { AuroraJamConnecting } from './AuroraJamConnecting';

const labels = {
  title: 'Connecting to Aurora...',
  subtitle: 'Make sure Aurora is running',
};

describe('AuroraJamConnecting', () => {
  it('(Snapshot) renders with labels', () => {
    const { container } = render(<AuroraJamConnecting labels={labels} />);
    expect(container).toMatchSnapshot();
  });
});
