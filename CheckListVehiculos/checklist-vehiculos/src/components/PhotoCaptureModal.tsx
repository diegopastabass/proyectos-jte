import React, { useRef, useState, useEffect } from 'react';

interface PhotoCaptureModalProps {
  show: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.6;

// Reduce la imagen al capturarla: evita guardar fotos a resolución completa en memoria
const toCompressedDataUrl = (source: CanvasImageSource, w: number, h: number): string | null => {
  if (!w || !h) return null;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return url.length > 100 ? url : null; // "data:," = imagen vacía
};

const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({ show, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!show || photoData) {
      stopCamera();
      return;
    }
    let cancelled = false;
    setVideoReady(false);
    setCameraError(null);

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Este navegador no permite usar la cámara (requiere HTTPS). Use "Elegir foto".');
        return;
      }
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          // El modal se cerró mientras se pedía el permiso: apagar la cámara de inmediato
          ms.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = ms;
        if (videoRef.current) videoRef.current.srcObject = ms;
      } catch (err: any) {
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Habilítelo en el navegador o use "Elegir foto".'
            : 'No se pudo acceder a la cámara. Use "Elegir foto".',
        );
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [show, photoData]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const url = toCompressedDataUrl(video, video.videoWidth, video.videoHeight);
    if (url) setPhotoData(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const url = toCompressedDataUrl(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(objectUrl);
      if (url) setPhotoData(url);
      else setCameraError('La imagen está vacía o dañada. Elija otra.');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setCameraError('No se pudo leer la imagen. Elija otra.');
    };
    img.src = objectUrl;
  };

  const handleConfirm = () => {
    if (photoData) {
      onCapture(photoData);
      setPhotoData(null);
      onClose();
    }
  };

  const handleClose = () => {
    setPhotoData(null);
    stopCamera();
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal d-block glass-modal" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content bg-light border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title text-dark">Capturar Foto Evidencia</h5>
            <button type="button" className="btn-close" onClick={handleClose}></button>
          </div>
          <div className="modal-body p-0 text-center position-relative bg-black" style={{ minHeight: '200px' }}>
            {photoData ? (
              <img src={photoData} alt="Captured" className="w-100" style={{ maxHeight: '60vh', objectFit: 'contain' }} />
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setVideoReady(true)} className="w-100" style={{ maxHeight: '60vh', objectFit: 'contain' }}></video>
                {cameraError && <div className="alert alert-warning m-3 text-start">{cameraError}</div>}
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="d-none" onChange={handleFile} />
          <div className="modal-footer border-secondary justify-content-center">
            {!photoData ? (
              <>
                <button className="btn btn-outline-secondary" onClick={() => fileRef.current?.click()}>
                  <i className="bi bi-image me-1"></i> Elegir foto
                </button>
                <button className="btn btn-primary rounded-circle" style={{ width: '60px', height: '60px' }} onClick={capturePhoto} disabled={!videoReady || !!cameraError}>
                  <i className="bi bi-camera fs-3"></i>
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-outline-secondary" onClick={() => setPhotoData(null)}>Volver a tomar</button>
                <button className="btn btn-success" onClick={handleConfirm}>Confirmar Foto</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoCaptureModal;
