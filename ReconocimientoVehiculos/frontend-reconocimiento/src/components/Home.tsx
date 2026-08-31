import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { api } from "../api";
import type { User, RecognitionResult } from "../types";
import logo from "../assets/logoJte.png";

interface HomeProps {
  user: User;
  onLogout: () => void;
  onGoToVehicles?: () => void;
}

export default function Home({ user, onLogout, onGoToVehicles }: HomeProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualPatente, setManualPatente] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecognitionResult | null>(null);

  // Estado para el formulario de registro dentro del modal
  const [registerNombre, setRegisterNombre] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const webcamRef = useRef<Webcam>(null);

  const captureAndSend = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await api.post("/recognition/detect-base64", {
        image: imageSrc,
      });
      setResult(response.data);
    } catch (err: any) {
      if (err.response?.data) {
        setResult(err.response.data);
      } else {
        setResult({
          status: "sin_patente",
          message: "Error de red o servidor no disponible",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [webcamRef]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPatente) return;

    setLoading(true);
    setResult(null);

    try {
      // Backend retorna: { status: 'registrado', data: vehiculo }
      //               o: { status: 'no_registrado', patente }
      // Siempre HTTP 200, nunca 404.
      const response = await api.get(`/vehiculos/patente/${manualPatente}`);
      const body = response.data;

      if (body.status === "registrado" && body.data) {
        setResult({
          status: "registrado",
          patente: body.data.patente,
          persona: body.data.persona ?? undefined,
        });
      } else {
        // status === 'no_registrado'
        setResult({
          status: "no_reconocido",
          patente: body.patente ?? manualPatente,
          message: "Patente no registrada en el sistema",
        });
      }
    } catch (err: any) {
      setResult({
        status: "sin_patente",
        message: "Error al consultar la base de datos",
      });
    } finally {
      setLoading(false);
    }
  };

  // Registra el dueño y el vehículo en la BD
  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerNombre.trim() || !result?.patente) return;

    setRegistering(true);
    setRegisterError("");

    try {
      // 1. Crear la persona
      const personaRes = await api.post("/personas", {
        nombre: registerNombre.trim(),
      });
      const persona = personaRes.data;

      // 2. Crear el vehículo asociado a esa persona
      await api.post("/vehiculos", {
        patente: result.patente,
        personaId: persona.id,
      });

      setRegisterSuccess(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message?.message ||
        err.response?.data?.message ||
        "Error al registrar el vehículo";
      setRegisterError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setRegistering(false);
    }
  };

  const clearResult = () => {
    setResult(null);
    setRegisterNombre("");
    setRegisterError("");
    setRegisterSuccess(false);
  };

  return (
    <div className="container py-4 vh-100 d-flex flex-column">
      {/* Navbar */}
      <div className="d-flex justify-content-between align-items-center mb-4 glass-panel px-3 py-2 px-md-4 py-md-3">
        {/* Logo / Brand */}
        <div className="d-flex align-items-center min-w-0">
          <img src={logo} alt="Logo" width={50} className="m-2" />
          <h5 className="mb-0 fw-bold text-dark text-truncate d-none d-sm-block">
            Reconocimiento
          </h5>
        </div>

        {/* Actions */}
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          {/* Usuario: oculto en móvil */}
          <div className="d-none d-md-flex align-items-center me-2 text-dark">
            <span className="text-secondary me-1">Hola,</span>
            <strong className="text-truncate" style={{ maxWidth: "120px" }}>
              {user.username}
            </strong>
            <span className="badge bg-primary ms-2">{user.rol}</span>
          </div>
          {/* Badge de rol solo en tablet (sm-md) */}
          <span className="badge bg-primary d-none d-sm-inline d-md-none">
            {user.rol}
          </span>
          {/* Botón Vehículos: solo para admin */}
          {onGoToVehicles && (
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={onGoToVehicles}
              title="Gestionar Vehículos"
            >
              <i className="bi bi-car-front"></i>
              <span className="d-none d-md-inline ms-1">Vehículos</span>
            </button>
          )}
          {/* Botón salir: solo ícono en móvil, ícono + texto en md+ */}
          <button
            className="btn btn-outline-danger btn-sm"
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <i className="bi bi-box-arrow-right"></i>
            <span className="d-none d-md-inline ms-1">Salir</span>
          </button>
        </div>
      </div>

      {/* Área de Trabajo */}
      <div className="row flex-grow-1">
        <div className="col-12 col-md-8 mx-auto d-flex flex-column justify-content-center">
          <div className="glass-panel p-4 mb-4 text-center">
            {/* Controles de Modo */}
            <div className="btn-group mb-4" role="group">
              <button
                type="button"
                className={`btn ${mode === "camera" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setMode("camera")}
              >
                <i className="bi bi-camera-video-fill me-2"></i> Usar Cámara
              </button>
              <button
                type="button"
                className={`btn ${mode === "manual" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setMode("manual")}
              >
                <i className="bi bi-keyboard me-2"></i> Ingreso Manual
              </button>
            </div>

            {/* MODO CÁMARA */}
            {mode === "camera" && (
              <div className="d-flex flex-column align-items-center">
                <div className="webcam-container mb-4">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "environment" }}
                    className="w-100 h-100"
                    style={{ objectFit: "cover" }}
                  />
                  <div className="plate-overlay">
                    <span className="plate-overlay-text">AA.AA.00</span>
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-lg px-5 py-3 rounded-pill shadow-lg"
                  onClick={captureAndSend}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>{" "}
                      Analizando Imagen...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-camera-fill fs-4 me-2"></i> CAPTURAR Y
                      ANALIZAR
                    </>
                  )}
                </button>
              </div>
            )}

            {/* MODO MANUAL */}
            {mode === "manual" && (
              <div className="p-4">
                <i className="bi bi-input-cursor-text display-1 text-primary mb-3"></i>
                <h4 className="text-dark">Búsqueda Manual</h4>
                <p className="text-secondary mb-4">
                  Ingresa la patente del vehículo a verificar
                </p>
                <form
                  onSubmit={handleManualSubmit}
                  className="d-flex justify-content-center"
                >
                  <div className="input-group input-group-lg w-75">
                    <input
                      type="text"
                      className="form-control text-center fw-bold text-uppercase"
                      placeholder="Ej: BBCC12"
                      value={manualPatente}
                      onChange={(e) =>
                        setManualPatente(e.target.value.toUpperCase())
                      }
                      maxLength={6}
                      required
                    />
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm"></span>
                      ) : (
                        <i className="bi bi-search"></i>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== MODALES ==================== */}
      {result && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(30,41,59,0.65)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              {/* ---- ACCESO PERMITIDO ---- */}
              {result.status === "registrado" && (
                <>
                  <div className="modal-header border-0 bg-success text-white">
                    <h5 className="modal-title fw-bold">
                      <i className="bi bi-check-circle-fill me-2"></i> Acceso
                      Permitido
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={clearResult}
                    ></button>
                  </div>
                  <div className="modal-body text-center p-4">
                    {result.patente && (
                      <div className="mb-3">
                        <p className="text-secondary mb-1 small">
                          Patente detectada
                        </p>
                        <div
                          className="d-inline-block border border-2 rounded px-4 py-2 fs-2 fw-bold text-uppercase"
                          style={{
                            background: "white",
                            color: "black",
                            letterSpacing: "4px",
                          }}
                        >
                          {result.patente}
                        </div>
                      </div>
                    )}
                    {result.persona && (
                      <div className="mt-3">
                        <p className="text-secondary mb-0 small">Residente</p>
                        <p className="fs-4 fw-bold text-dark mb-0">
                          {result.persona.nombre}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="modal-footer border-0 justify-content-center">
                    <button
                      type="button"
                      className="btn btn-success px-5"
                      onClick={clearResult}
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              )}

              {/* ---- PATENTE NO REGISTRADA ---- */}
              {result.status === "no_reconocido" && (
                <>
                  <div className="modal-header border-0 bg-warning">
                    <h5 className="modal-title fw-bold text-dark">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>{" "}
                      Patente No Registrada
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={clearResult}
                    ></button>
                  </div>
                  <div className="modal-body p-4">
                    {/* Patente detectada */}
                    {result.patente && (
                      <div className="text-center mb-4">
                        <p className="text-secondary mb-1 small">
                          Patente detectada
                        </p>
                        <div
                          className="d-inline-block border border-2 rounded px-4 py-2 fs-2 fw-bold text-uppercase"
                          style={{
                            background: "white",
                            color: "black",
                            letterSpacing: "4px",
                          }}
                        >
                          {result.patente}
                        </div>
                      </div>
                    )}

                    {/* Formulario de registro o confirmación de éxito */}
                    {registerSuccess ? (
                      <div className="text-center py-2">
                        <i className="bi bi-check-circle-fill text-success fs-1 mb-2 d-block"></i>
                        <p className="fw-bold text-dark mb-0">
                          Vehículo registrado exitosamente
                        </p>
                        <p className="text-secondary small">
                          El vehículo y su dueño han sido guardados en el
                          sistema.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleRegisterVehicle}>
                        <p className="text-dark fw-semibold mb-2">
                          ¿Deseas registrar este vehículo? Ingresa el nombre del
                          propietario:
                        </p>
                        {registerError && (
                          <div className="alert alert-danger py-2 small">
                            <i className="bi bi-exclamation-circle me-1"></i>
                            {registerError}
                          </div>
                        )}
                        <div className="input-group mb-3">
                          <span className="input-group-text">
                            <i className="bi bi-person"></i>
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Nombre del dueño (ej: Juan Pérez)"
                            value={registerNombre}
                            onChange={(e) => setRegisterNombre(e.target.value)}
                            required
                            autoFocus
                          />
                        </div>
                        <div className="d-grid gap-2">
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={registering || !registerNombre.trim()}
                          >
                            {registering ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2"></span>{" "}
                                Registrando...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-floppy-fill me-2"></i>{" "}
                                Registrar Vehículo
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={clearResult}
                            disabled={registering}
                          >
                            No registrar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                  {registerSuccess && (
                    <div className="modal-footer border-0 justify-content-center">
                      <button
                        type="button"
                        className="btn btn-success px-5"
                        onClick={clearResult}
                      >
                        Cerrar
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ---- SIN PATENTE / ERROR ---- */}
              {result.status === "sin_patente" && (
                <>
                  <div className="modal-header border-0 bg-danger text-white">
                    <h5 className="modal-title fw-bold">
                      <i className="bi bi-x-circle-fill me-2"></i> Error de
                      Detección
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={clearResult}
                    ></button>
                  </div>
                  <div className="modal-body text-center p-4">
                    <i className="bi bi-camera-video-off fs-1 text-danger mb-3 d-block"></i>
                    <p className="text-dark">
                      {result.message ||
                        "No se pudo detectar una patente válida en la imagen."}
                    </p>
                    <p className="text-secondary small">
                      Intenta nuevamente acercando la cámara a la patente.
                    </p>
                  </div>
                  <div className="modal-footer border-0 justify-content-center">
                    <button
                      type="button"
                      className="btn btn-outline-secondary px-5"
                      onClick={clearResult}
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
