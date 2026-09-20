import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PillRatingGroup } from './PillRatingGroup';

const defaultLabels = {
  favoriteAdd: 'Add to favorites',
  favoriteRemove: 'Remove from favorites',
  dislike: 'Dislike track',
};

describe('PillRatingGroup', () => {
  it('(Snapshot) renders default unfavorited and undisliked state', () => {
    const { container } = render(
      <PillRatingGroup
        isFavorite={false}
        isDisliked={false}
        onToggleFavorite={vi.fn()}
        onDislike={vi.fn()}
        labels={defaultLabels}
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it('(Snapshot) renders favorited state', () => {
    const { container } = render(
      <PillRatingGroup
        isFavorite={true}
        isDisliked={false}
        onToggleFavorite={vi.fn()}
        onDislike={vi.fn()}
        labels={defaultLabels}
        size="sm"
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it('triggers onToggleFavorite when favorite button is clicked', async () => {
    const user = userEvent.setup();
    const onToggleFavorite = vi.fn();
    const onDislike = vi.fn();

    render(
      <PillRatingGroup
        isFavorite={false}
        isDisliked={false}
        onToggleFavorite={onToggleFavorite}
        onDislike={onDislike}
        labels={defaultLabels}
      />,
    );

    const favoriteButton = screen.getByTestId('pill-favorite-button');
    await user.click(favoriteButton);

    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onDislike).not.toHaveBeenCalled();
  });

  it('triggers onDislike when dislike button is clicked', async () => {
    const user = userEvent.setup();
    const onToggleFavorite = vi.fn();
    const onDislike = vi.fn();

    render(
      <PillRatingGroup
        isFavorite={true}
        isDisliked={false}
        onToggleFavorite={onToggleFavorite}
        onDislike={onDislike}
        labels={defaultLabels}
      />,
    );

    const dislikeButton = screen.getByTestId('pill-dislike-button');
    await user.click(dislikeButton);

    expect(onDislike).toHaveBeenCalledTimes(1);
    expect(onToggleFavorite).not.toHaveBeenCalled();
  });
});
