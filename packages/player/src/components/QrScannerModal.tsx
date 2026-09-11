import jsQR from 'jsqr';
import { Camera, RefreshCw, X } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';

import { Button } from '@aurora/ui';

type QrScannerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onScan: (url: string) => void;
};

export const QrScannerModal: FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
        animFrameId.current = null;
      }
      return;
    }

    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanLoop();
        }
      } catch {
        setError(
          'No se pudo acceder a la cámara. Por favor concede permisos de cámara.',
        );
      }
    };

    const scanLoop = () => {
      if (!videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const raw = code.data.trim();
          let parsedUrl = raw;

          if (raw.startsWith('aurora://')) {
            try {
              const urlObj = new URL(raw);
              const hostParam =
                urlObj.searchParams.get('host') ||
                urlObj.searchParams.get('url');
              const portParam = urlObj.searchParams.get('port') || '4120';
              if (hostParam) {
                parsedUrl = hostParam.startsWith('http')
                  ? hostParam
                  : `http://${hostParam}:${portParam}`;
              }
            } catch {
              // fallback to raw
            }
          }

          if (parsedUrl) {
            onScan(parsedUrl);
            onClose();
            return;
          }
        }
      }

      animFrameId.current = requestAnimationFrame(scanLoop);
    };

    void startCamera();

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      {/* Header */}
      <div className="bg-background-secondary/80 border-border flex items-center justify-between border-b p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Camera className="text-primary size-5" />
          <h2 className="text-base font-bold">Escanear QR de Aurora PC</h2>
        </div>
        <Button
          size="icon-sm"
          variant="text"
          onClick={onClose}
          className="text-white"
        >
          <X size={20} />
        </Button>
      </div>

      {/* Camera View / Scanner box */}
      <div className="relative flex flex-1 flex-col items-center justify-center p-4">
        {error ? (
          <div className="flex max-w-xs flex-col items-center gap-4 text-center">
            <p className="text-accent-red text-sm font-medium">{error}</p>
            <Button
              variant="default"
              onClick={() => {
                setError(null);
              }}
              className="gap-2"
            >
              <RefreshCw size={16} /> Reintentar
            </Button>
          </div>
        ) : (
          <div className="border-primary relative h-72 w-72 overflow-hidden rounded-2xl border-2 shadow-[0_0_20px_rgba(255,105,180,0.5)]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning line animation */}
            <div className="pointer-events-none absolute inset-0">
              <div className="bg-primary h-0.5 w-full animate-pulse shadow-[0_0_8px_#ff69b4]" />
              <div className="absolute top-2 left-2 h-6 w-6 rounded-tl border-t-2 border-l-2 border-white" />
              <div className="absolute top-2 right-2 h-6 w-6 rounded-tr border-t-2 border-r-2 border-white" />
              <div className="absolute bottom-2 left-2 h-6 w-6 rounded-bl border-b-2 border-l-2 border-white" />
              <div className="absolute right-2 bottom-2 h-6 w-6 rounded-br border-r-2 border-b-2 border-white" />
            </div>
          </div>
        )}

        <p className="mt-6 max-w-xs text-center text-xs text-zinc-400">
          Apunta con la cámara al código QR que aparece en tu PC (icono de
          código QR en la barra superior de Aurora).
        </p>
      </div>
    </div>
  );
};
