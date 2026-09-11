import type { Meta, StoryObj } from '@storybook/react-vite';

import { AuroraJam } from '@aurora/ui';

const meta = {
  title: 'Remote/AuroraJam/Connecting',
  component: AuroraJam.Connecting,
  tags: ['autodocs'],
} satisfies Meta<typeof AuroraJam.Connecting>;

export default meta;
type Story = StoryObj<typeof AuroraJam.Connecting>;

export const Default: Story = {
  render: () => (
    <AuroraJam>
      <AuroraJam.Connecting
        labels={{
          title: 'Connecting to Aurora...',
          subtitle: 'Make sure Aurora is running and Aurora Jam is enabled',
        }}
      />
    </AuroraJam>
  ),
};
