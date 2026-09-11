import { render, screen } from '@testing-library/react';

import { AuroraJamHeader } from './AuroraJamHeader';

const labels = {
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  failed: 'Disconnected',
};

describe('AuroraJamHeader', () => {
  it('(Snapshot) renders the connected header', () => {
    const { container } = render(
      <AuroraJamHeader
        connectionStatus="connected"
        connectionStatusLabels={labels}
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it('shows the label for the current connection status', () => {
    render(
      <AuroraJamHeader
        connectionStatus="reconnecting"
        connectionStatusLabels={labels}
      />,
    );

    expect(screen.getByTestId('connection-status-badge')).toHaveTextContent(
      'Reconnecting',
    );
  });

  it('shows the failed label when disconnected', () => {
    render(
      <AuroraJamHeader
        connectionStatus="failed"
        connectionStatusLabels={labels}
      />,
    );

    expect(screen.getByTestId('connection-status-badge')).toHaveTextContent(
      'Disconnected',
    );
  });
});
