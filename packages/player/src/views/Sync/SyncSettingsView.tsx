import { invoke } from '@tauri-apps/api/core';
import {
  Camera,
  Cloud,
  Download,
  Github,
  HardDrive,
  QrCode,
  RefreshCw,
  Search,
  Upload,
  Wifi,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { FC, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Badge, Button, Input, Toggle } from '@aurora/ui';

import { QrScannerModal } from '../../components/QrScannerModal';
import { p2pSyncService } from '../../services/p2pSyncService';
import type { SyncProviderType } from '../../services/sync/types';
import { isTauriEnvironment } from '../../services/universalStore';

type SyncTab = 'webdav' | 'gist' | 'lan' | 'backup';

export const SyncSettingsView: FC = () => {
  const [activeTab, setActiveTab] = useState<SyncTab>('webdav');
  const [provider, setProvider] = useState<SyncProviderType>('webdav');

  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUser, setWebdavUser] = useState('');
  const [webdavPass, setWebdavPass] = useState('');
  const [webdavPath, setWebdavPath] = useState('aurora_sync.json');

  const [gistToken, setGistToken] = useState('');
  const [gistId, setGistId] = useState('');

  const [lanUrl, setLanUrl] = useState('');
  const [lanServerInfo, setLanServerInfo] = useState<{
    ip: string;
    port: number;
  } | null>(null);

  const [lastSync, setLastSync] = useState<number | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSearchingLan, setIsSearchingLan] = useState(false);

  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadInitialData = async () => {
    const activeProvider = await p2pSyncService.getSyncProvider();
    setProvider(activeProvider);
    if (activeProvider !== 'none') {
      setActiveTab(activeProvider as SyncTab);
    }

    const webdavConfig = await p2pSyncService.getWebDavConfig();
    setWebdavUrl(webdavConfig.url);
    setWebdavUser(webdavConfig.username);
    setWebdavPass(webdavConfig.password);
    setWebdavPath(webdavConfig.remotePath || 'aurora_sync.json');

    const gistConfig = await p2pSyncService.getGistConfig();
    setGistToken(gistConfig.token);
    setGistId(gistConfig.gistId || '');

    const savedLanUrl = await p2pSyncService.getSyncServerUrl();
    setLanUrl(savedLanUrl);

    const autoSyncEnabled = await p2pSyncService.isAutoSyncEnabled();
    setAutoSync(autoSyncEnabled);

    const lastSyncTime = await p2pSyncService.getLastSyncTime();
    setLastSync(lastSyncTime);

    if (isTauriEnvironment()) {
      try {
        const info = await invoke<{ ip: string; port: number }>(
          'sync_server_info',
        );
        setLanServerInfo(info);
      } catch {
        setLanServerInfo(null);
      }
    }
  };

  useEffect(() => {
    void loadInitialData();
  }, []);

  const handleSaveWebDav = async () => {
    if (!webdavUrl.trim()) {
      toast.error('Introduce la URL de tu servidor WebDAV');
      return;
    }
    await p2pSyncService.setWebDavConfig({
      url: webdavUrl,
      username: webdavUser,
      password: webdavPass,
      remotePath: webdavPath,
    });
    setProvider('webdav');
    toast.success('Configuración de WebDAV guardada');
    void handleSyncNow();
  };

  const handleSaveGist = async () => {
    if (!gistToken.trim()) {
      toast.error('Introduce tu Personal Access Token de GitHub');
      return;
    }
    await p2pSyncService.setGistConfig({
      token: gistToken,
      gistId: gistId.trim() || undefined,
    });
    setProvider('gist');
    toast.success('Configuración de GitHub Gist guardada');
    void handleSyncNow();
  };

  const handleSaveLan = async () => {
    if (!lanUrl.trim()) {
      toast.error('Introduce la URL del PC');
      return;
    }
    await p2pSyncService.setSyncServerUrl(lanUrl);
    setProvider('lan');
    toast.success('Dirección local guardada');
    void handleSyncNow();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const result = await p2pSyncService.testActiveConnection();
    setIsTesting(false);
    if (result.success) {
      toast.success('¡Conexión exitosa con el almacenamiento!');
    } else {
      toast.error(`Fallo en la prueba de conexión: ${result.error}`);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    const result = await p2pSyncService.syncNow();
    setIsSyncing(false);

    if (result.success) {
      setLastSync(Date.now());
      const counts = result.syncedCounts;
      toast.success(
        `¡Sincronización completada! (${counts?.tracks ?? 0} pistas, ${counts?.artists ?? 0} artistas, ${counts?.playlists ?? 0} listas)`,
      );
    } else {
      toast.error(`Error al sincronizar: ${result.error}`);
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    setAutoSync(enabled);
    await p2pSyncService.setAutoSyncEnabled(enabled);
    toast.info(
      enabled
        ? 'Sincronización automática activada'
        : 'Sincronización automática desactivada',
    );
  };

  const handleShowQr = async () => {
    const qrString = await p2pSyncService.generateQrConfigString();
    setQrCodeData(qrString);
    setShowQrModal(true);
  };

  const handleScanSuccess = async (scannedData: string) => {
    setIsScannerOpen(false);
    toast.info('Configuración detectada. Aplicando...');
    const applied = await p2pSyncService.applyQrConfigString(scannedData);
    if (applied) {
      await loadInitialData();
      toast.success('¡Configuración de sincronización importada!');
      void handleSyncNow();
    } else {
      toast.error(
        'El código QR escaneado no contiene una configuración válida',
      );
    }
  };

  const handleLanDiscovery = async () => {
    setIsSearchingLan(true);
    toast.info('Buscando Aurora en la red Wi-Fi...');
    const foundUrl = await p2pSyncService.discoverPcOnLan();
    setIsSearchingLan(false);

    if (foundUrl) {
      setLanUrl(foundUrl);
      setProvider('lan');
      toast.success(`¡Aurora encontrado en ${foundUrl}! Sincronizando...`);
      void handleSyncNow();
    } else {
      toast.error('No se encontró ningún PC con Aurora en la red local.');
    }
  };

  const handleExportBackup = async () => {
    try {
      const jsonContent = await p2pSyncService.exportLibraryBackup();
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      const dateIso = new Date().toISOString().slice(0, 10);
      anchor.download = `aurora_backup_${dateIso}.json`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      toast.success('Copia de seguridad exportada');
    } catch {
      toast.error('Error al exportar la copia de seguridad');
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (fileEvent) => {
      const content = fileEvent.target?.result as string;
      if (!content) {
        return;
      }
      setIsSyncing(true);
      const result = await p2pSyncService.importLibraryBackup(content);
      setIsSyncing(false);

      if (result.success) {
        toast.success(
          `¡Copia restaurada! (${result.syncedCounts?.tracks ?? 0} pistas importadas)`,
        );
      } else {
        toast.error(`Error al restaurar: ${result.error}`);
      }
    };
    reader.readAsText(file);
    if (event.target) {
      event.target.value = '';
    }
  };

  const formatRelativeTime = (timestamp: number | null) => {
    if (!timestamp) {
      return 'Nunca';
    }
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) {
      return 'Hace un momento';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `Hace ${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `Hace ${hours} h`;
    }
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-4">
      {/* Top Status Card */}
      <div className="border-border bg-background-secondary flex flex-col gap-3 rounded-xl border-(length:--border-width) p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cloud className="text-primary size-6" />
            <div>
              <h2 className="text-base font-bold">Sincronización</h2>
              <p className="text-foreground-secondary text-xs">
                {provider === 'webdav'
                  ? 'Nube personal WebDAV / Nextcloud'
                  : provider === 'gist'
                    ? 'Nube GitHub Gist'
                    : provider === 'lan'
                      ? 'Red local (P2P Wi-Fi)'
                      : 'Sin proveedor configurado'}
              </p>
            </div>
          </div>
          <Badge
            variant="pill"
            className={
              isSyncing
                ? 'bg-accent-blue animate-pulse text-white'
                : lastSync
                  ? 'bg-accent-green text-black'
                  : 'bg-zinc-600 text-white'
            }
          >
            {isSyncing
              ? 'Sincronizando...'
              : lastSync
                ? 'Conectado'
                : 'Sin sincronizar'}
          </Badge>
        </div>

        <div className="border-border/50 text-foreground-secondary flex items-center justify-between border-t pt-2 text-xs">
          <span>Última sincronización: {formatRelativeTime(lastSync)}</span>
          <div className="flex items-center gap-2">
            <span>Auto-sync</span>
            <Toggle checked={autoSync} onChange={handleToggleAutoSync} />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="default"
            size="sm"
            disabled={isSyncing}
            onClick={() => void handleSyncNow()}
            className="flex flex-1 items-center justify-center gap-1.5"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            Sincronizar ahora
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleShowQr()}
            className="flex items-center gap-1.5"
            title="Compartir configuración con otro dispositivo"
          >
            <QrCode size={14} />
            Compartir QR
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5"
            title="Escanear QR de otro dispositivo"
          >
            <Camera size={14} />
            Escanear QR
          </Button>
        </div>
      </div>

      {/* Provider Tabs */}
      <div className="bg-background-secondary/80 border-border grid grid-cols-4 gap-1 rounded-lg border p-1">
        <button
          type="button"
          onClick={() => setActiveTab('webdav')}
          className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'webdav'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground-secondary hover:text-foreground'
          }`}
        >
          <Cloud size={16} />
          <span>WebDAV</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gist')}
          className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'gist'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground-secondary hover:text-foreground'
          }`}
        >
          <Github size={16} />
          <span>GitHub</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lan')}
          className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'lan'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground-secondary hover:text-foreground'
          }`}
        >
          <Wifi size={16} />
          <span>Red Local</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'backup'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground-secondary hover:text-foreground'
          }`}
        >
          <HardDrive size={16} />
          <span>Copia</span>
        </button>
      </div>

      {/* Tab 1: WebDAV / Nextcloud */}
      {activeTab === 'webdav' && (
        <div className="border-border bg-background-secondary flex flex-col gap-4 rounded-xl border-(length:--border-width) p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Cloud size={16} className="text-primary" /> Nube Personal (WebDAV
              / Nextcloud)
            </h3>
            <p className="text-foreground-secondary mt-1 text-xs">
              Compatible con Nextcloud, ownCloud, Koofr, pCloud, Seafile o
              cualquier servidor WebDAV personal.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-foreground mb-1 block text-xs font-semibold">
                URL del servidor WebDAV
              </label>
              <Input
                size="sm"
                placeholder="https://mi-servidor.com/remote.php/dav/files/usuario/"
                value={webdavUrl}
                onChange={(event) => setWebdavUrl(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Usuario
                </label>
                <Input
                  size="sm"
                  placeholder="usuario"
                  value={webdavUser}
                  onChange={(event) => setWebdavUser(event.target.value)}
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Contraseña / App Token
                </label>
                <Input
                  size="sm"
                  type="password"
                  placeholder="••••••••"
                  value={webdavPass}
                  onChange={(event) => setWebdavPass(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-foreground mb-1 block text-xs font-semibold">
                Nombre del archivo remoto
              </label>
              <Input
                size="sm"
                placeholder="aurora_sync.json"
                value={webdavPath}
                onChange={(event) => setWebdavPath(event.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isTesting}
              onClick={() => void handleTestConnection()}
              className="flex-1"
            >
              {isTesting ? 'Probando...' : 'Probar conexión'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleSaveWebDav()}
              className="flex-1"
            >
              Guardar y sincronizar
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2: GitHub Gist */}
      {activeTab === 'gist' && (
        <div className="border-border bg-background-secondary flex flex-col gap-4 rounded-xl border-(length:--border-width) p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Github size={16} className="text-primary" /> Nube GitHub Gist
              (Gratis y Privado)
            </h3>
            <p className="text-foreground-secondary mt-1 text-xs">
              Guarda tu biblioteca en un Gist secreto en tu cuenta de GitHub.
              Solo necesitas un Personal Access Token con permiso
              &quot;gist&quot;.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-foreground mb-1 block text-xs font-semibold">
                Personal Access Token (PAT)
              </label>
              <Input
                size="sm"
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={gistToken}
                onChange={(event) => setGistToken(event.target.value)}
              />
            </div>

            <div>
              <label className="text-foreground mb-1 block text-xs font-semibold">
                ID del Gist (Opcional)
              </label>
              <Input
                size="sm"
                placeholder="Se creará automáticamente si lo dejas vacío"
                value={gistId}
                onChange={(event) => setGistId(event.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isTesting}
              onClick={() => void handleTestConnection()}
              className="flex-1"
            >
              {isTesting ? 'Probando...' : 'Probar conexión'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleSaveGist()}
              className="flex-1"
            >
              Guardar y sincronizar
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Red Local LAN */}
      {activeTab === 'lan' && (
        <div className="border-border bg-background-secondary flex flex-col gap-4 rounded-xl border-(length:--border-width) p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Wifi size={16} className="text-primary" /> Red Local (Wi-Fi)
            </h3>
            <p className="text-foreground-secondary mt-1 text-xs">
              Sincronización directa entre dispositivos en la misma red local.
            </p>
          </div>

          {lanServerInfo && (
            <div className="bg-background border-border flex flex-col gap-1 rounded-lg border p-3">
              <span className="text-foreground text-xs font-semibold">
                Servidor de sincronización PC:
              </span>
              <code className="text-primary font-mono text-xs">
                http://{lanServerInfo.ip}:{lanServerInfo.port}
              </code>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-foreground text-xs font-semibold">
              Dirección del servidor PC
            </label>
            <div className="flex gap-2">
              <Input
                size="sm"
                placeholder="http://192.168.1.50:4122"
                value={lanUrl}
                onChange={(event) => setLanUrl(event.target.value)}
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={isSearchingLan}
                onClick={() => void handleLanDiscovery()}
                className="flex items-center gap-1"
              >
                <Search
                  size={14}
                  className={isSearchingLan ? 'animate-spin' : ''}
                />
                Buscar en Wi-Fi
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleSaveLan()}
              className="w-full"
            >
              Guardar y conectar
            </Button>
          </div>
        </div>
      )}

      {/* Tab 4: Copia de Seguridad */}
      {activeTab === 'backup' && (
        <div className="border-border bg-background-secondary flex flex-col gap-4 rounded-xl border-(length:--border-width) p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <HardDrive size={16} className="text-primary" /> Copia de
              Seguridad Manual
            </h3>
            <p className="text-foreground-secondary mt-1 text-xs">
              Exporta tu biblioteca completa a un archivo .json para guardarlo
              en Drive o enviártelo por mensaje.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => void handleExportBackup()}
              className="flex h-20 flex-col items-center justify-center gap-2 text-xs font-semibold"
            >
              <Download size={20} className="text-primary" />
              Exportar archivo
            </Button>

            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 flex-col items-center justify-center gap-2 text-xs font-semibold"
            >
              <Upload size={20} className="text-primary" />
              Importar archivo
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* QR Modal for sharing config */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-background-secondary border-border flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border p-6">
            <h3 className="text-base font-bold">Escanear Configuración</h3>
            <p className="text-foreground-secondary text-center text-xs">
              Abre Aurora en tu móvil, pulsa &quot;Escanear QR&quot; en este
              menú y apunta a este código para vincularlos al instante.
            </p>
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={qrCodeData} size={220} level="M" />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowQrModal(false)}
              className="mt-2 w-full"
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* QR Scanner Modal for mobile camera */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(scanned) => void handleScanSuccess(scanned)}
      />
    </div>
  );
};
