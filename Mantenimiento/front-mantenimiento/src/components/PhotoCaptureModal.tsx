import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  show: boolean;
  onHide: () => void;
  /**
   * Devuelve la imagen como dataUrl (base64) en lugar de File,
   * ya que el almacenamiento se hace en el estado de ReportData.
   */
  onCapture: (dataUrl: string, fieldId: string) => void;
  fieldId: string;
  fieldLabel: string;
}

export default function PhotoCaptureModal({
  show,
  onHide,
  onCapture,
  fieldId,
  fieldLabel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (show) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [show]);

  const startCamera = async () => {
    setError("");
    setIsReady(false);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("No se pudo acceder a la cámara. Verifique los permisos.");
      console.error(err);
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsReady(false);
    }
  }, [stream]);

  const handleVideoReady = () => setIsReady(true);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const targetSize = 800; // Mayor resolución para el PDF
    canvas.width = targetSize;
    canvas.height = targetSize;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const minDimension = Math.min(videoWidth, videoHeight);
    const startX = (videoWidth - minDimension) / 2;
    const startY = (videoHeight - minDimension) / 2;

    context.drawImage(
      video,
      startX,
      startY,
      minDimension,
      minDimension,
      0,
      0,
      targetSize,
      targetSize,
    );

    // Obtener dataUrl directamente desde el canvas — no necesitamos File
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    onCapture(dataUrl, fieldId);
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    onHide();
  };

  const modalClass = show ? "modal fade show d-block" : "modal fade";

  return (
    <>
      <div
        className={modalClass}
        tabIndex={-1}
        style={{ backgroundColor: "rgba(0,0,0,0.85)", zIndex: 1055 }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div
            className="modal-content border-0 shadow-lg"
            style={{ borderRadius: "16px", overflow: "hidden" }}
          >
            {/* Header */}
            <div
              className="modal-header border-0 text-white"
              style={{ background: "#103E84", padding: "16px 20px" }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-camera-fill"></i>
                <h6 className="modal-title mb-0 fw-semibold">{fieldLabel}</h6>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
              />
            </div>

            {/* Cuerpo: Visor de cámara */}
            <div
              className="modal-body p-0 position-relative bg-black"
              style={{ minHeight: "320px" }}
            >
              {error && (
                <div className="alert alert-danger m-3 mb-0">{error}</div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                onCanPlay={handleVideoReady}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "65vh",
                  display: isReady ? "block" : "none",
                  objectFit: "cover",
                }}
              />

              {!isReady && !error && (
                <div
                  className="d-flex flex-column justify-content-center align-items-center gap-3 text-white"
                  style={{ height: "320px" }}
                >
                  <div className="spinner-border" role="status" />
                  <small className="text-white-50">Iniciando cámara...</small>
                </div>
              )}

              {/* Guía de recorte cuadrado */}
              {isReady && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "78%",
                    paddingBottom: "78%",
                    border: "2px solid rgba(255,255,255,0.85)",
                    borderRadius: "8px",
                    pointerEvents: "none",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  }}
                />
              )}

              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            {/* Footer: Botón de captura */}
            <div
              className="modal-footer justify-content-center border-0 py-3"
              style={{ background: "#0a0a0a" }}
            >
              <button
                type="button"
                className="btn btn-light rounded-circle d-flex align-items-center justify-content-center"
                style={{
                  width: "64px",
                  height: "64px",
                  border: "4px solid #103E84",
                  boxShadow: "0 0 0 3px rgba(255,255,255,0.2)",
                  transition: "transform 0.1s",
                }}
                onClick={takePhoto}
                disabled={!isReady}
                onMouseDown={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.transform =
                    "scale(0.92)")
                }
                onMouseUp={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.transform =
                    "scale(1)")
                }
              >
                <i
                  className="bi bi-camera-fill"
                  style={{ fontSize: "1.6rem", color: "#103E84" }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
