import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FC, ReactNode, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import { Button } from '@aurora/ui';

const ROW_HEIGHT = 64;

export const MobileItemPages: FC<{ items: ReactNode[] }> = ({ items }) => {
  const { t } = useTranslation('pagination');
  const viewport = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(1);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setCapacity(Math.max(1, Math.floor(entry.contentRect.height / ROW_HEIGHT)));
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const pages = Math.max(1, Math.ceil(items.length / capacity));
  const page = Math.min(Math.floor(offset / capacity), pages - 1);
  return (
    <div className="aurora-mobile-pages">
      <div className="aurora-mobile-pages-toolbar justify-end">
        <Button size="icon" aria-label={t('previous')} disabled={page === 0}
          onClick={() => setOffset((page - 1) * capacity)}><ChevronLeft size={18} /></Button>
        <span className="text-xs tabular-nums">{page + 1}/{pages}</span>
        <Button size="icon" aria-label={t('next')} disabled={page === pages - 1}
          onClick={() => setOffset((page + 1) * capacity)}><ChevronRight size={18} /></Button>
      </div>
      <div ref={viewport} className="aurora-mobile-page-rows aurora-mobile-item-rows">
        {items.slice(page * capacity, (page + 1) * capacity)}
      </div>
    </div>
  );
};
