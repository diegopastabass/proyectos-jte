import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  show: boolean;
  onHide: () => void;
  onCapture: (file: File, fieldId: string) => void;
  fieldId: string; // El ID del campo que está solicitando la foto
  fieldLabel: string; // El nombre legible del campo
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

  // Iniciar cámara cuando se abre el modal
  useEffect(() => {
    if (show) {
      startCamera();
    } else {
      stopCamera();
    }
    // Limpieza al desmontar
    return () => {
      stopCamera();
    };
  }, [show]);

  const startCamera = async () => {
    setError("");
    setIsReady(false);
    try {
      // Solicitamos video. Preferimos la cámara trasera si existe (environment)
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

  const handleVideoReady = () => {
    setIsReady(true);
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Dimensiones objetivo
    const targetSize = 500;

    // Configurar el canvas al tamaño objetivo
    canvas.width = targetSize;
    canvas.height = targetSize;

    // Lógica de recorte cuadrado central (Center Crop)
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const minDimension = Math.min(videoWidth, videoHeight);

    // Calcular desde dónde empezar a cortar en el video fuente para que quede centrado
    const startX = (videoWidth - minDimension) / 2;
    const startY = (videoHeight - minDimension) / 2;

    // Dibujar en el canvas:
    // drawImage(fuente, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH)
    context.drawImage(
      video,
      startX,
      startY,
      minDimension,
      minDimension, // Origen (rectángulo central del video)
      0,
      0,
      targetSize,
      targetSize, // Destino (el canvas de 500x500)
    );

    // Convertir el canvas a Blob y luego a File
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const timestamp = new Date().getTime();
          // Nombre de archivo descriptivo
          const filename = `capture_${fieldId}_${timestamp}.jpg`;
          const file = new File([blob], filename, { type: "image/jpeg" });

          // Enviar el archivo al componente padre y cerrar
          onCapture(file, fieldId);
          handleClose();
        }
      },
      "image/jpeg",
      0.9,
    ); // Calidad JPEG 90%
  };

  const handleClose = () => {
    stopCamera();
    onHide();
  };

  // Si no debe mostrarse, no renderizar nada (controlado por Bootstrap classes)
  const modalClass = show ? "modal fade show d-block" : "modal fade";
  const backdropClass = show ? "modal-backdrop fade show" : "";

  return (
    <>
      <div
        className={modalClass}
        tabIndex={-1}
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Foto para: {fieldLabel}</h5>
              <button
                type="button"
                className="btn-close"
                onClick={handleClose}
              ></button>
            </div>
            <div
              className="modal-body p-0 position-relative bg-dark text-center"
              style={{ minHeight: "300px" }}
            >
              {error && <div className="alert alert-danger m-3">{error}</div>}

              {/* Video en vivo */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                onCanPlay={handleVideoReady}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "60vh",
                  display: isReady ? "block" : "none",
                }}
              />

              {!isReady && !error && (
                <div
                  className="d-flex justify-content-center align-items-center"
                  style={{ height: "300px" }}
                >
                  <div
                    className="spinner-border text-light"
                    role="status"
                  ></div>
                </div>
              )}

              {/* Guía visual superpuesta para mostrar el área cuadrada que se capturará */}
              {isReady && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "80%", // Aproximación visual
                    paddingBottom: "80%", // Crear un cuadrado
                    border: "2px dashed rgba(255, 255, 255, 0.7)",
                    pointerEvents: "none",
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)", // Oscurecer el área fuera del recorte
                  }}
                ></div>
              )}

              {/* Canvas oculto para procesar la imagen */}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
            <div className="modal-footer justify-content-center">
              <button
                type="button"
                className="btn btn-primary btn-lg rounded-circle p-3"
                onClick={takePhoto}
                disabled={!isReady}
              >
                <i className="bi bi-camera-fill fs-3"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      {show && <div className={backdropClass}></div>}
    </>
  );
}
