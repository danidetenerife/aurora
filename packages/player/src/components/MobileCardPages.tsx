import { ChevronLeft, ChevronRight, Music } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import {
  Button,
  Input,
  type CardsRowItem,
  type CardsRowLabels,
} from '@aurora/ui';

const ROW_HEIGHT = 60;

export const MobileCardPages: FC<{
  items: CardsRowItem[];
  labels: CardsRowLabels;
}> = ({ items, labels }) => {
  const { t } = useTranslation('pagination');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [capacity, setCapacity] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) =>
      setCapacity(
        Math.max(1, Math.floor(entry.contentRect.height / ROW_HEIGHT)),
      ),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const filtered = items.filter((item) =>
    `${item.title} ${item.subtitle ?? ''}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / capacity));
  const page = Math.min(Math.floor(offset / capacity), pages - 1);
  return (
    <div className="aurora-mobile-pages">
      <div className="aurora-mobile-pages-toolbar">
        <Input
          aria-label={labels.filterPlaceholder}
          placeholder={labels.filterPlaceholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOffset(0);
          }}
          className="h-8 min-w-0 flex-1"
        />
        <Button
          size="icon"
          aria-label={t('previous')}
          disabled={page === 0}
          onClick={() => setOffset((page - 1) * capacity)}
        >
          <ChevronLeft size={18} />
        </Button>
        <span className="text-xs tabular-nums">
          {page + 1}/{pages}
        </span>
        <Button
          size="icon"
          aria-label={t('next')}
          disabled={page === pages - 1}
          onClick={() => setOffset((page + 1) * capacity)}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
      <div ref={viewport} className="aurora-mobile-page-rows">
        {filtered.slice(page * capacity, (page + 1) * capacity).map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid="mobile-dashboard-card"
            onClick={item.onClick}
            className="border-border flex min-h-[60px] w-full items-center gap-3 border-b py-1 text-left"
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                className="size-9 shrink-0 rounded-md object-cover"
              />
            ) : (
              <Music className="size-9 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-semibold leading-tight">
                {item.title}
              </span>
              <span className="text-foreground-secondary block break-words text-xs leading-tight">
                {item.subtitle}
              </span>
            </span>
          </button>
        ))}
        {!filtered.length && <p className="text-sm">{labels.nothingFound}</p>}
      </div>
    </div>
  );
};
