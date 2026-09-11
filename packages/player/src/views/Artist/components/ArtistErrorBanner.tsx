import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { FC, useState } from 'react';

import { Button } from '@aurora/ui';

import { useProviders } from '../../../hooks/useProviders';
import { useProvidersStore } from '../../../stores/providersStore';

type ArtistErrorBannerProps = {
  providerId: string;
  artistId: string;
  bioError?: unknown;
  tracksError?: unknown;
  albumsError?: unknown;
  relatedError?: unknown;
  onRetry?: () => void;
};

export const ArtistErrorBanner: FC<ArtistErrorBannerProps> = ({
  providerId,
  artistId,
  bioError,
  tracksError,
  albumsError,
  relatedError,
  onRetry,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const metadataProviders = useProviders('metadata');
  const activeMetadata = useProvidersStore((state) => state.active.metadata);

  const errorsList: { section: string; error: unknown }[] = [];
  if (bioError) {
    errorsList.push({ section: 'Biografía', error: bioError });
  }
  if (tracksError) {
    errorsList.push({ section: 'Canciones populares', error: tracksError });
  }
  if (albumsError) {
    errorsList.push({ section: 'Álbumes', error: albumsError });
  }
  if (relatedError) {
    errorsList.push({ section: 'Artistas similares', error: relatedError });
  }

  if (errorsList.length === 0) {
    return null;
  }

  const diagnosticText = JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      artistId,
      providerId,
      activeMetadata,
      availableProviders: metadataProviders.map((p) => ({
        id: p.id,
        name: p.name,
      })),
      errors: errorsList.map((e) => ({
        section: e.section,
        message: e.error instanceof Error ? e.error.message : String(e.error),
        stack: e.error instanceof Error ? e.error.stack : undefined,
      })),
    },
    null,
    2,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      data-testid="artist-error-banner"
      className="border-accent-red/40 bg-accent-red/10 text-foreground m-4 rounded-md border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-accent-red size-5 shrink-0" />
          <span className="text-sm font-semibold">
            {errorsList.length === 1
              ? `Hubo un problema al cargar ${errorsList[0].section.toLowerCase()} para "${artistId}".`
              : `Hubo problemas al cargar información para "${artistId}".`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onRetry}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className="size-3.5" />
              Reintentar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs"
          >
            {isExpanded ? (
              <>
                Ocultar diagnóstico <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                Ver diagnóstico <ChevronDown className="size-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-accent-red/20 mt-3 border-t pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-foreground-secondary font-mono text-xs">
              Detalle del error (proveedor: {providerId}):
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="flex h-7 items-center gap-1 text-xs"
            >
              <Copy className="size-3" />
              {copied ? '¡Copiado!' : 'Copiar diagnóstico'}
            </Button>
          </div>
          <pre className="bg-background-secondary text-foreground-secondary max-h-60 overflow-auto rounded p-3 font-mono text-xs whitespace-pre-wrap">
            {diagnosticText}
          </pre>
        </div>
      )}
    </div>
  );
};
