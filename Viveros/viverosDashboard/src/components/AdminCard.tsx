import { useEffect, useState } from "react";
import Card from "../components/Card";

interface AdminCardProps {
  token: string;
}

interface EnvVars {
  MONITOR_INTERVAL: string;
  TEMP_MONITOREO: string;
  HUM_MONITOREO: string;
  TEMP_AMB: string;
}

export default function AdminCard({ token }: AdminCardProps) {
  const [env, setEnv] = useState<EnvVars>({
    MONITOR_INTERVAL: "",
    TEMP_MONITOREO: "",
    HUM_MONITOREO: "",
    TEMP_AMB: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnv = async () => {
      setLoading(true);
      try {
        const res = await fetch("https://app.jteanalytics.cl/viveros/env", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Error al cargar variables");
        const data: EnvVars = await res.json();
        setEnv(data);
      } catch (error) {
        console.error(error);
        setMessage("Error al cargar variables");
      } finally {
        setLoading(false);
      }
    };

    fetchEnv();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEnv((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("https://app.jteanalytics.cl/viveros/env", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(env),
      });

      if (!res.ok) throw new Error("Error al guardar variables");
      setMessage("Variables actualizadas correctamente");
    } catch (error) {
      console.error(error);
      setMessage("Error al guardar variables");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Cargando variables...</p>;

  return (
    <div className="col-12 col-md-10 col-lg-6 mb-4">
      <Card>
        <h5>Gestión de Variables de Monitoreo</h5>
        <h6>Modifica los valores y presiona Guardar</h6>
        <br />
        {message && <div className="alert alert-info mt-2">{message}</div>}

        <div className="mb-3">
          <label className="form-label">
            Intervalo de Monitoreo en Segundos
          </label>
          <input
            type="number"
            className="form-control"
            name="MONITOR_INTERVAL"
            value={env.MONITOR_INTERVAL}
            onChange={handleChange}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Temperatura de Monitoreo en °C</label>
          <input
            type="number"
            className="form-control"
            name="TEMP_MONITOREO"
            value={env.TEMP_MONITOREO}
            onChange={handleChange}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Humedad de Monitoreo en %</label>
          <input
            type="number"
            className="form-control"
            name="HUM_MONITOREO"
            value={env.HUM_MONITOREO}
            onChange={handleChange}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Temperatura Ambiental en °C</label>
          <input
            type="number"
            className="form-control"
            name="TEMP_AMB"
            value={env.TEMP_AMB}
            onChange={handleChange}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </Card>
    </div>
  );
}
