import type { Meta, StoryObj } from '@storybook/react-vite';

import { AuroraJam } from '@aurora/ui';

const meta = {
  title: 'Remote/AuroraJam/Error',
  component: AuroraJam.Error,
  tags: ['autodocs'],
} satisfies Meta<typeof AuroraJam.Error>;

export default meta;
type Story = StoryObj<typeof AuroraJam.Error>;

export const Default: Story = {
  render: () => (
    <AuroraJam>
      <AuroraJam.Error
        labels={{
          title: 'Could not connect to Aurora',
          subtitle:
            'Make sure Aurora is running and Aurora Jam is enabled in Settings',
        }}
      />
    </AuroraJam>
  ),
};
