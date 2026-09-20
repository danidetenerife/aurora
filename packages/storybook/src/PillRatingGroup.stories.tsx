import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { PillRatingGroup } from '@aurora/ui';

const meta: Meta<typeof PillRatingGroup> = {
  title: 'Components/PillRatingGroup',
  component: PillRatingGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PillRatingGroup>;

export const AllVariants: Story = {
  render: () => {
    const [isFavoriteDefault, setIsFavoriteDefault] = useState(false);
    const [isDislikedDefault, setIsDislikedDefault] = useState(false);

    const [isFavoriteSm, setIsFavoriteSm] = useState(true);
    const [isDislikedSm, setIsDislikedSm] = useState(false);

    const labels = {
      favoriteAdd: 'Add to favorites',
      favoriteRemove: 'Remove from favorites',
      dislike: 'Dislike track',
    };

    return (
      <div className="flex flex-col gap-6 items-center p-8 bg-background">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-foreground-secondary">
            Default Size (Interactive)
          </span>
          <PillRatingGroup
            size="default"
            isFavorite={isFavoriteDefault}
            isDisliked={isDislikedDefault}
            onToggleFavorite={() => {
              setIsFavoriteDefault((prev) => !prev);
              if (!isFavoriteDefault) setIsDislikedDefault(false);
            }}
            onDislike={() => {
              setIsDislikedDefault((prev) => !prev);
              if (!isDislikedDefault) setIsFavoriteDefault(false);
            }}
            labels={labels}
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-foreground-secondary">
            Small Size (Favorited)
          </span>
          <PillRatingGroup
            size="sm"
            isFavorite={isFavoriteSm}
            isDisliked={isDislikedSm}
            onToggleFavorite={() => {
              setIsFavoriteSm((prev) => !prev);
              if (!isFavoriteSm) setIsDislikedSm(false);
            }}
            onDislike={() => {
              setIsDislikedSm((prev) => !prev);
              if (!isDislikedSm) setIsFavoriteSm(false);
            }}
            labels={labels}
          />
        </div>
      </div>
    );
  },
};
