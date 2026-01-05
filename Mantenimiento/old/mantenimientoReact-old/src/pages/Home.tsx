import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Loading from "./Loading";
import Card, { CardBody } from "../components/Card";

interface Maintenance {
  id: string;
  client_id: number;
  admin_id: number;
  maintainer_id: number;
  maintenance_type: string;
  observations: string | null;
  scheduled_date: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface Maintainer {
  id: number;
  name: string;
}

function Home() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [maintainers, setMaintainers] = useState<Maintainer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const loadMaintenances = async () => {
      setError(null);
      setLoading(true);

      try {
        const token = localStorage.getItem("token");

        const [maintenancesRes, maintainersRes] = await Promise.all([
          fetch(
            "http://localhost:3002/endpoints/mantenimiento/maintenances/admin",
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: token ? `Bearer ${token}` : "",
              },
            }
          ),
          fetch(
            "http://localhost:3002/endpoints/mantenimiento/users/byrole/2",
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: token ? `Bearer ${token}` : "",
              },
            }
          ),
        ]);

        if (!maintenancesRes.ok) {
          throw new Error(`Error HTTP: ${maintenancesRes.status}`);
        }
        if (!maintainersRes.ok) {
          throw new Error(`Error HTTP: ${maintainersRes.status}`);
        }

        const maintenanceData = await maintenancesRes.json();

        if (maintenanceData.success) {
          setMaintenances(maintenanceData.maintenances);
        } else {
          setError("Error al cargar mantenimientos");
        }

        const maintainersData = await maintainersRes.json();
        if (maintainersData.success) {
          setMaintainers(maintainersData.users);
        } else {
          setError("Error al cargar a los mantenedores");
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Error desconocido en /home");
        }
      } finally {
        setLoading(false);
      }
    };

    loadMaintenances();
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <div>
      <Navbar />
      <div className="container mt-4 position-relative">
        <h1>Lista de Mantenimientos</h1>

        {error && <p className="text-danger">{error}</p>}

        {!loading && !error && maintenances.length === 0 && (
          <p>No hay mantenimientos disponibles.</p>
        )}

        <ul className="list-group">
          {maintenances.map((m) => (
            <Card key={m.id}>
              <CardBody
                title={m.maintenance_type}
                tipo={m.maintenance_type}
                fecha_programada={m.scheduled_date}
                completado={m.completed}
                mantenedor={
                  maintainers.find(
                    (mt) => Number(mt.id) === Number(m.maintainer_id)
                  )?.name || "Desconocido"
                }
              ></CardBody>
              {/* Botón para navegar al resumen */}
              <button
                className="btn btn-outline-primary mt-2"
                onClick={() => navigate(`/mantenimiento/resume/${m.id}`)}
              >
                Ver Resumen
              </button>
            </Card>
          ))}
        </ul>

        {/* Botón flotante para crear nueva sesión */}
        <button
          className="btn btn-primary rounded-circle position-fixed"
          style={{
            bottom: "20px",
            right: "20px",
            width: "50px",
            height: "50px",
            fontSize: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => navigate("/mantenimiento/new")}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default Home;
