import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircle2, Github, RefreshCw, XCircle } from 'lucide-react';
import { FC, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { p2pSyncService } from '../../services/p2pSyncService';
import { TvButton } from './TvButton';

export const TvSyncSection: FC = () => {
  const [token, setToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [userLogin, setUserLogin] = useState<string | null>(null);

  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_SYNC_SECTION',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  const loadStatus = async () => {
    try {
      const gistConfig = await p2pSyncService.getGistConfig();
      if (gistConfig.token?.trim()) {
        setToken(gistConfig.token);
        setIsConnected(true);
        // Test user
        fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${gistConfig.token.trim()}`,
            Accept: 'application/vnd.github+json',
          },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((userData: { login?: string } | null) => {
            if (userData?.login) {
              setUserLogin(userData.login);
            }
          })
          .catch(() => {});
      } else {
        setIsConnected(false);
        setUserLogin(null);
      }

      const syncTime = await p2pSyncService.getLastSyncTime();
      setLastSync(syncTime);

      const isAuto = await p2pSyncService.isAutoSyncEnabled();
      setAutoSync(isAuto);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleConnect = async () => {
    if (!token.trim()) {
      toast.error('Introduce tu Personal Access Token de GitHub');
      return;
    }

    setIsSyncing(true);
    toast.info('Verificando token con GitHub...');

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) {
        setIsSyncing(false);
        toast.error('Token de GitHub no válido o sin permisos de Gist');
        return;
      }

      const user = (await response.json()) as { login?: string };
      setUserLogin(user.login || null);

      await p2pSyncService.setGistConfig({ token: token.trim() });
      await p2pSyncService.setSyncProvider('gist');

      const result = await p2pSyncService.syncNow();
      setIsSyncing(false);

      if (result.success) {
        setIsConnected(true);
        setLastSync(Date.now());
        toast.success(
          `¡Conectado como ${user.login || 'GitHub'}! Sincronización completada.`,
        );
      } else {
        toast.warning(
          `Conectado como ${user.login || 'GitHub'}, pero fallo de sincronización: ${result.error}`,
        );
      }
    } catch (error) {
      setIsSyncing(false);
      toast.error(
        `Error al conectar: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      );
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    toast.info('Sincronizando con GitHub Gist...');
    try {
      const result = await p2pSyncService.syncNow();
      setIsSyncing(false);
      if (result.success) {
        setLastSync(Date.now());
        toast.success('¡Sincronización con GitHub completada con éxito!');
      } else {
        toast.error(`Error al sincronizar: ${result.error}`);
      }
    } catch {
      setIsSyncing(false);
      toast.error('Error durante la sincronización');
    }
  };

  const handleDisconnect = async () => {
    await p2pSyncService.setGistConfig({ token: '' });
    await p2pSyncService.setSyncProvider('none');
    setToken('');
    setIsConnected(false);
    setUserLogin(null);
    toast.info('Desconectado de GitHub');
  };

  const handleToggleAutoSync = async () => {
    const nextVal = !autoSync;
    setAutoSync(nextVal);
    await p2pSyncService.setAutoSyncEnabled(nextVal);
    toast.info(
      nextVal
        ? 'Sincronización automática activada'
        : 'Sincronización automática desactivada',
    );
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        data-testid="tv-sync-section"
        className="flex max-w-3xl flex-col gap-6 py-2"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <Github className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Sincronización con GitHub</h1>
            <p className="text-sm text-zinc-400">
              Conecta tu cuenta para sincronizar favoritos, listas de reproducción y preferencias de escucha entre tus dispositivos.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-300">Estado:</span>
              {isConnected ? (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Conectado {userLogin ? `(@${userLogin})` : ''}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-0.5 text-xs font-bold text-zinc-400">
                  <XCircle className="h-3.5 w-3.5" />
                  Sin conectar
                </span>
              )}
            </div>
            {lastSync && (
              <span className="text-xs text-zinc-500">
                Último sync: {new Date(lastSync).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              GitHub Personal Access Token (PAT)
            </label>
            <input
              data-testid="tv-github-token-input"
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border-2 border-zinc-700 bg-zinc-950 p-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-400"
            />
            <span className="text-xs text-zinc-500">
              Se requiere un token clásico con el permiso &apos;gist&apos; habilitado.
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-3">
            <TvButton
              focusKey="tv-sync-connect-btn"
              onClick={() => void handleConnect()}
              destinations={{ down: 'tv-control-play' }}
            >
              {isSyncing ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Conectando...
                </span>
              ) : (
                'Conectar y Sincronizar'
              )}
            </TvButton>

            {isConnected && (
              <>
                <TvButton
                  focusKey="tv-sync-now-btn"
                  onClick={() => void handleSyncNow()}
                  destinations={{ down: 'tv-control-play' }}
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sincronizar ahora
                  </span>
                </TvButton>

                <TvButton
                  focusKey="tv-sync-autosync-btn"
                  onClick={() => void handleToggleAutoSync()}
                  destinations={{ down: 'tv-control-play' }}
                >
                  Auto-sync: {autoSync ? 'Activado' : 'Desactivado'}
                </TvButton>

                <TvButton
                  focusKey="tv-sync-disconnect-btn"
                  onClick={() => void handleDisconnect()}
                  destinations={{ down: 'tv-control-play' }}
                >
                  Desconectar
                </TvButton>
              </>
            )}
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  );
};
