import isEmpty from 'lodash-es/isEmpty';
import { ChevronRight, Play } from 'lucide-react';
import { useMemo } from 'react';

import type { AttributedResult } from '@aurora/plugin-sdk';
import { CardsRow, CardsRowItem, CardsRowLabels, Loader } from '@aurora/ui';

import { isCapacitorEnvironment } from '../../../services/universalStore';

type DashboardCardsWidgetProps<T> = {
  results: AttributedResult<T>[] | undefined;
  isLoading: boolean;
  title: string;
  labels: CardsRowLabels;
  mapItem: (item: T, result: AttributedResult<T>) => CardsRowItem;
  'data-testid'?: string;
};

export const DashboardCardsWidget = <T,>({
  results,
  isLoading,
  title,
  labels,
  mapItem,
  'data-testid': testId,
}: DashboardCardsWidgetProps<T>) => {
  if (isLoading) {
    return (
      <div
        data-testid={testId}
        className="flex items-center justify-center p-4"
      >
        <Loader data-testid={testId ? `${testId}-loader` : undefined} />
      </div>
    );
  }

  if (isEmpty(results)) {
    return null;
  }

  if (isCapacitorEnvironment()) {
    const isArtist =
      testId?.includes('artist') || title.toLowerCase().includes('artista');
    const allItems = results!.flatMap((result) =>
      result.items.map((item) => {
        const mapped = mapItem(item, result);
        return {
          ...mapped,
          subtitle:
            mapped.subtitle ?? (isArtist ? 'Artista' : result.providerName),
        };
      }),
    );

    const isPlaylist =
      testId?.includes('playlist') || title.toLowerCase().includes('lista');
    const isNewReleases =
      testId?.includes('new-releases') ||
      testId?.includes('release') ||
      title.toLowerCase().includes('lanzamiento') ||
      title.toLowerCase().includes('releases');
    const isGrid = isPlaylist || isNewReleases;

    return (
      <div data-testid={testId} className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold tracking-tight text-white select-none">
              {title}
            </h2>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400 select-none" />
        </div>

        <div
          className={
            isGrid
              ? 'grid grid-cols-2 gap-3.5 px-1 pb-4 select-none'
              : 'no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth px-1 pb-2 select-none'
          }
        >
          {allItems.map((item) => {
            if (isArtist) {
              return (
                <button
                  type="button"
                  key={item.id}
                  data-testid="card"
                  onClick={item.onClick}
                  className="flex w-32 flex-none cursor-pointer snap-start flex-col items-center text-left transition-transform select-none focus:outline-none active:scale-95"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-full bg-zinc-900 shadow-lg ring-1 shadow-black/60 ring-white/10">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-2 w-full text-center">
                    <div
                      data-testid="card-title"
                      className="text-sm leading-snug font-bold break-words text-white"
                    >
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-xs break-words text-zinc-400">
                      Artista
                    </div>
                  </div>
                </button>
              );
            }

            return (
              <button
                type="button"
                key={item.id}
                data-testid="card"
                onClick={item.onClick}
                className={
                  isGrid
                    ? 'group flex w-full cursor-pointer flex-col text-left transition-transform select-none focus:outline-none active:scale-95'
                    : 'group flex w-36 flex-none cursor-pointer snap-start flex-col text-left transition-transform select-none focus:outline-none active:scale-95'
                }
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-900 shadow-md ring-1 shadow-black/60 ring-white/10">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {item.action && (
                    <div
                      className="absolute top-2 right-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.action}
                    </div>
                  )}
                  <div className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-md backdrop-blur-md transition-transform active:scale-90">
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-white" />
                  </div>
                </div>

                <div className="mt-2 w-full">
                  <div
                    data-testid="card-title"
                    className="text-sm leading-snug font-semibold break-words text-white"
                  >
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div className="mt-0.5 text-xs break-words text-zinc-400">
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      {results?.map((result) => (
        <DashboardCardsProviderRow
          key={result.providerId}
          result={result}
          title={title}
          labels={labels}
          mapItem={mapItem}
        />
      ))}
    </div>
  );
};

type DashboardCardsProviderRowProps<T> = {
  result: AttributedResult<T>;
  title: string;
  labels: CardsRowLabels;
  mapItem: (item: T, result: AttributedResult<T>) => CardsRowItem;
};

const DashboardCardsProviderRow = <T,>({
  result,
  title,
  labels,
  mapItem,
}: DashboardCardsProviderRowProps<T>) => {
  const items: CardsRowItem[] = useMemo(
    () => result.items.map((item) => mapItem(item, result)),
    [result, mapItem],
  );

  return (
    <CardsRow
      title={title}
      badge={result.providerName}
      items={items}
      labels={labels}
    />
  );
};
