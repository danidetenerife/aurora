import type { Meta } from '@storybook/react-vite';

import { AuroraJam, ConnectionStatusLabels } from '@aurora/ui';

const connectionStatusLabels: ConnectionStatusLabels = {
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  failed: 'Disconnected',
};

const meta = {
  title: 'Remote/AuroraJam/Header',
  component: AuroraJam.Header,
  tags: ['autodocs'],
} satisfies Meta<typeof AuroraJam.Header>;

export default meta;

export const Connecting = {
  render: () => (
    <div className="bg-background">
      <AuroraJam.Header
        connectionStatus="connecting"
        connectionStatusLabels={connectionStatusLabels}
      />
    </div>
  ),
};

export const Connected = {
  render: () => (
    <div className="bg-background">
      <AuroraJam.Header
        connectionStatus="connected"
        connectionStatusLabels={connectionStatusLabels}
      />
    </div>
  ),
};

export const Reconnecting = {
  render: () => (
    <div className="bg-background">
      <AuroraJam.Header
        connectionStatus="reconnecting"
        connectionStatusLabels={connectionStatusLabels}
      />
    </div>
  ),
};

export const Failed = {
  render: () => (
    <div className="bg-background">
      <AuroraJam.Header
        connectionStatus="failed"
        connectionStatusLabels={connectionStatusLabels}
      />
    </div>
  ),
};
