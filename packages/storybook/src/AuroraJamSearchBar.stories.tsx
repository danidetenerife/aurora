import type { Meta } from '@storybook/react-vite';
import { useState } from 'react';

import {
  AuroraJam,
  AuroraJamSearchBarLabels,
  ConnectionStatusLabels,
} from '@aurora/ui';

const labels: AuroraJamSearchBarLabels = {
  placeholder: 'Search for music',
};

const connectionStatusLabels: ConnectionStatusLabels = {
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  failed: 'Disconnected',
};

const meta = {
  title: 'Remote/AuroraJam/SearchBar',
  component: AuroraJam.SearchBar,
  tags: ['autodocs'],
} satisfies Meta<typeof AuroraJam.SearchBar>;

export default meta;

export const InHeader = {
  render: () => {
    const [value, setValue] = useState('');

    return (
      <div className="bg-background">
        <AuroraJam.Header
          connectionStatus="connected"
          connectionStatusLabels={connectionStatusLabels}
        >
          <AuroraJam.SearchBar
            value={value}
            onChange={setValue}
            labels={labels}
          />
        </AuroraJam.Header>
      </div>
    );
  },
};

export const InHeaderWithValue = {
  render: () => {
    const [value, setValue] = useState('King Gizzard');

    return (
      <div className="bg-background">
        <AuroraJam.Header
          connectionStatus="connected"
          connectionStatusLabels={connectionStatusLabels}
        >
          <AuroraJam.SearchBar
            value={value}
            onChange={setValue}
            labels={labels}
          />
        </AuroraJam.Header>
      </div>
    );
  },
};
