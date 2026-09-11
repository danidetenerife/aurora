import { Search, X } from 'lucide-react';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input } from '@nuclearplayer/ui';

import { SearchBoxPopover } from './SearchBoxPopover';
import { useSearchBox } from './useSearchBox';

export const SearchBox: FC = () => {
  const { t } = useTranslation('search');
  const {
    query,
    setQuery,
    inputRef,
    isPopoverOpen,
    openPopover,
    closePopover,
    handleKeyDown,
    submit,
    clear,
    popover,
  } = useSearchBox();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <div className="relative w-full">
      <form
        role="search"
        action=""
        onSubmit={handleSubmit}
        className="relative w-full"
      >
        <button
          type="submit"
          aria-label={t('placeholder')}
          className="text-foreground-secondary hover:text-foreground absolute top-1/2 left-2.5 z-10 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 transition-colors"
        >
          <Search className="size-4" />
        </button>
        <Input
          ref={inputRef}
          data-testid="search-box"
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={openPopover}
          onBlur={closePopover}
          placeholder={t('placeholder')}
          tone="secondary"
          className="h-8 pl-9 pr-8"
        />
        {query.length > 0 && (
          <Button
            type="button"
            data-testid="search-box-clear"
            variant="text"
            onClick={clear}
            className="absolute top-1/2 right-1 z-10 size-6 -translate-y-1/2 justify-center p-0"
          >
            <X className="size-4" />
          </Button>
        )}
      </form>
      <SearchBoxPopover
        isOpen={isPopoverOpen}
        recentSearches={popover.recentSearches}
        highlightedIndex={popover.highlightedIndex}
        onHighlight={popover.highlightIndex}
        onSelect={popover.select}
        onClearHistory={popover.clearHistory}
      />
    </div>
  );
};
