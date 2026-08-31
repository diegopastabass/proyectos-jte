import React, { useRef, useState, useEffect } from 'react';

interface PhotoCaptureModalProps {
  show: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({ show, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);

  useEffect(() => {
    if (show && !photoData) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [show, photoData]);

  const startCamera = async () => {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(ms);
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
      }
    } catch (err) {
      console.error("Error accessing camera", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPhotoData(canvas.toDataURL('image/jpeg', 0.8));
      }
    }
  };

  const handleRetake = () => {
    setPhotoData(null);
  };

  const handleConfirm = () => {
    if (photoData) {
      onCapture(photoData);
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block glass-modal" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content bg-light border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title text-dark">Capturar Foto Evidencia</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-0 text-center position-relative bg-black">
            {!photoData ? (
              <video ref={videoRef} autoPlay playsInline className="w-100" style={{ maxHeight: '60vh', objectFit: 'contain' }}></video>
            ) : (
              <img src={photoData} alt="Captured" className="w-100" style={{ maxHeight: '60vh', objectFit: 'contain' }} />
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          </div>
          <div className="modal-footer border-secondary justify-content-center">
            {!photoData ? (
              <button className="btn btn-primary rounded-circle" style={{ width: '60px', height: '60px' }} onClick={capturePhoto}>
                <i className="bi bi-camera fs-3"></i>
              </button>
            ) : (
              <>
                <button className="btn btn-outline-light" onClick={handleRetake}>Volver a tomar</button>
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
