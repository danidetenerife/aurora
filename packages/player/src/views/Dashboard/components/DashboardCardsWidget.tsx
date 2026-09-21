import isEmpty from 'lodash-es/isEmpty';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { AttributedResult } from '@aurora/plugin-sdk';
import {
  Badge,
  Button,
  CardsRow,
  CardsRowItem,
  CardsRowLabels,
  Loader,
} from '@aurora/ui';

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

  const isNewReleases =
    testId?.includes('new-releases') ||
    testId?.includes('release') ||
    title.toLowerCase().includes('lanzamiento') ||
    title.toLowerCase().includes('releases');

  if (isNewReleases) {
    return (
      <div data-testid={testId} className="flex flex-col gap-4">
        {results?.map((result) => (
          <DashboardCardsDesktopNewReleases
            key={result.providerId}
            result={result}
            title={title}
            mapItem={mapItem}
          />
        ))}
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

type DashboardCardsDesktopNewReleasesProps<T> = {
  result: AttributedResult<T>;
  title: string;
  mapItem: (item: T, result: AttributedResult<T>) => CardsRowItem;
};

const DashboardCardsDesktopNewReleases = <T,>({
  result,
  title,
  mapItem,
}: DashboardCardsDesktopNewReleasesProps<T>) => {
  const [page, setPage] = useState(0);
  const items: CardsRowItem[] = useMemo(
    () => result.items.map((item) => mapItem(item, result)),
    [result, mapItem],
  );

  const pageSize = 10;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-foreground text-lg font-bold">{title}</h2>
          {result.providerName && (
            <Badge data-testid="cards-row-badge" variant="pill" color="purple">
              {result.providerName}
            </Badge>
          )}
          {totalPages > 1 && (
            <div className="border-border/40 bg-background-secondary/60 text-foreground-secondary ml-2 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
              <Button
                variant="ghost"
                size="icon"
                data-testid="new-releases-prev-page"
                className="h-5 w-5 rounded-full text-zinc-400 hover:text-white disabled:opacity-30"
                disabled={page === 0}
                onClick={() =>
                  setPage((previousPage) => Math.max(0, previousPage - 1))
                }
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-foreground min-w-[3rem] text-center text-xs">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                data-testid="new-releases-next-page"
                className="h-5 w-5 rounded-full text-zinc-400 hover:text-white disabled:opacity-30"
                disabled={page >= totalPages - 1}
                onClick={() =>
                  setPage((previousPage) =>
                    Math.min(totalPages - 1, previousPage + 1),
                  )
                }
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {paginatedItems.map((item) => (
          <div
            key={item.id}
            data-testid="card"
            role="button"
            tabIndex={0}
            onClick={item.onClick}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                item.onClick?.();
              }
            }}
            className="group bg-background-secondary/40 hover:bg-background-secondary/80 border-border/40 hover:border-border flex cursor-pointer items-center justify-between gap-3.5 rounded-xl border p-2.5 transition-all select-none focus:outline-none focus:ring-1 focus:ring-white/20"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900 shadow-md">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play className="h-5 w-5 fill-white text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  data-testid="card-title"
                  className="text-foreground text-sm font-bold break-normal whitespace-normal [overflow-wrap:anywhere] leading-snug group-hover:underline"
                >
                  {item.title}
                </div>
                {item.subtitle && (
                  <div className="text-foreground-secondary mt-0.5 text-xs break-normal whitespace-normal [overflow-wrap:anywhere] leading-tight">
                    {item.subtitle}
                  </div>
                )}
              </div>
            </div>
            {item.action && (
              <div
                className="shrink-0"
                onClick={(event) => event.stopPropagation()}
              >
                {item.action}
              </div>
            )}
          </div>
        ))}
      </div>
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
