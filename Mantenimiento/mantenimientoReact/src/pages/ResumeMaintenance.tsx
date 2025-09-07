import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Loading from "./Loading";
import ErrorPage from "./Error";

interface Device {
  id: string;
  maintenance_id: string;
  device_type: string;
  serial_number: string;
  model: string;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  device_id: string;
  description: string;
  task_status: boolean;
  created_at: string;
  updated_at: string;
}

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

interface Client {
  id: number;
  name: string;
}

interface Maintainer {
  id: number;
  name: string;
}

function ResumeMaintenance() {
  const { maintenanceId } = useParams<{ maintenanceId: string }>();
  const navigate = useNavigate();

  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tasks, setTasks] = useState<{ [deviceId: string]: Task[] }>({});
  const [client, setClient] = useState<Client | null>(null);
  const [maintainer, setMaintainer] = useState<Maintainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!maintenanceId) {
      setError("ID de mantenimiento no proporcionado");
      setLoading(false);
      return;
    }

    const fetchMaintenanceData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        // Obtener información del mantenimiento
        const maintenanceRes = await fetch(
          `http://localhost:3002/endpoints/mantenimiento/maintenances/find/${maintenanceId}`,
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : "",
            },
          }
        );

        if (!maintenanceRes.ok) {
          throw new Error(`Error HTTP: ${maintenanceRes.status}`);
        }

        const maintenanceData = await maintenanceRes.json();
        if (!maintenanceData.success) {
          throw new Error("Error al cargar el mantenimiento");
        }

        setMaintenance(maintenanceData.maintenance);

        // Obtener información del cliente
        if (maintenanceData.maintenance.client_id) {
          const clientRes = await fetch(
            `http://localhost:3002/endpoints/mantenimiento/clients/find/${maintenanceData.maintenance.client_id}`,
            {
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            }
          );

          if (clientRes.ok) {
            const clientData = await clientRes.json();
            if (clientData.success) {
              setClient(clientData.client);
            }
          }
        }

        // Obtener información del mantenedor
        if (maintenanceData.maintenance.maintainer_id) {
          const maintainerRes = await fetch(
            `http://localhost:3002/endpoints/mantenimiento/users/user/${maintenanceData.maintenance.maintainer_id}`,
            {
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            }
          );

          if (maintainerRes.ok) {
            const maintainerData = await maintainerRes.json();
            if (maintainerData.success) {
              setMaintainer(maintainerData.user);
            }
          }
        }

        // Obtener dispositivos del mantenimiento
        const devicesRes = await fetch(
          `http://localhost:3002/endpoints/mantenimiento/devices/maintenance/${maintenanceId}`,
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : "",
            },
          }
        );

        if (!devicesRes.ok) {
          throw new Error(`Error HTTP: ${devicesRes.status}`);
        }

        const devicesData = await devicesRes.json();
        if (!devicesData.success) {
          throw new Error("Error al cargar los dispositivos");
        }

        const devicesList = devicesData.devices || [];
        setDevices(devicesList);

        // Obtener tareas para cada dispositivo
        const tasksPromises = devicesList.map(async (device: Device) => {
          const tasksRes = await fetch(
            `http://localhost:3002/endpoints/mantenimiento/tasks/device/${device.id}`,
            {
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            }
          );

          if (tasksRes.ok) {
            const tasksData = await tasksRes.json();
            if (tasksData.success) {
              return { deviceId: device.id, tasks: tasksData.tasks || [] };
            }
          }
          return { deviceId: device.id, tasks: [] };
        });

        const tasksResults = await Promise.all(tasksPromises);
        const tasksMap: { [deviceId: string]: Task[] } = {};

        tasksResults.forEach((result) => {
          tasksMap[result.deviceId] = result.tasks;
        });

        setTasks(tasksMap);
      } catch (err: unknown) {
        console.error("Error fetching maintenance data:", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenanceData();
  }, [maintenanceId]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorPage />;
  }

  if (!maintenance) {
    return <ErrorPage />;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div>
      <Navbar />

      <div className="container mt-4">
        <button className="btn btn-secondary mb-3" onClick={() => navigate(-1)}>
          &larr; Volver
        </button>

        <div className="card mb-4">
          <div className="card-header bg-primary text-white">
            <h2 className="mb-0">Resumen de Mantenimiento</h2>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <p>
                  <strong>ID:</strong> {maintenance.id}
                </p>
                <p>
                  <strong>Cliente:</strong> {client?.name || "No disponible"}
                </p>
                <p>
                  <strong>Mantenedor:</strong>{" "}
                  {maintainer?.name || "No disponible"}
                </p>
              </div>
              <div className="col-md-6">
                <p>
                  <strong>Tipo:</strong> {maintenance.maintenance_type}
                </p>
                <p>
                  <strong>Fecha programada:</strong>{" "}
                  {formatDate(maintenance.scheduled_date)}
                </p>
                <p>
                  <strong>Estado:</strong>
                  <span
                    className={`badge ${
                      maintenance.completed ? "bg-success" : "bg-warning"
                    } ms-2`}
                  >
                    {maintenance.completed ? "Completado" : "Pendiente"}
                  </span>
                </p>
              </div>
            </div>

            {maintenance.observations && (
              <div className="mt-3">
                <strong>Observaciones:</strong>
                <p className="mt-1">{maintenance.observations}</p>
              </div>
            )}
          </div>
        </div>

        <h3 className="mb-3">Dispositivos</h3>

        {devices.length === 0 ? (
          <div className="alert alert-info">
            No hay dispositivos registrados para este mantenimiento.
          </div>
        ) : (
          <div className="accordion" id="devicesAccordion">
            {devices.map((device) => (
              <div className="accordion-item" key={device.id}>
                <h2 className="accordion-header" id={`heading-${device.id}`}>
                  <button
                    className="accordion-button collapsed"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target={`#collapse-${device.id}`}
                    aria-expanded="false"
                    aria-controls={`collapse-${device.id}`}
                  >
                    <div className="d-flex justify-content-between align-items-center w-100 me-3">
                      <span>
                        {device.device_type} - {device.model || "Sin modelo"}
                        {device.serial_number &&
                          ` (SN: ${device.serial_number})`}
                      </span>
                      <span className="badge bg-secondary">
                        {tasks[device.id]?.length || 0} tareas
                      </span>
                    </div>
                  </button>
                </h2>
                <div
                  id={`collapse-${device.id}`}
                  className="accordion-collapse collapse"
                  aria-labelledby={`heading-${device.id}`}
                  data-bs-parent="#devicesAccordion"
                >
                  <div className="accordion-body">
                    <h5>Tareas del dispositivo</h5>

                    {!tasks[device.id] || tasks[device.id].length === 0 ? (
                      <p className="text-muted">
                        Este dispositivo no tiene tareas registradas.
                      </p>
                    ) : (
                      <ul className="list-group">
                        {tasks[device.id].map((task) => (
                          <li
                            key={task.id}
                            className="list-group-item d-flex justify-content-between align-items-center"
                          >
                            <span>{task.description}</span>
                            <span
                              className={`badge ${
                                task.task_status ? "bg-success" : "bg-secondary"
                              }`}
                            >
                              {task.task_status ? "Completada" : "Pendiente"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResumeMaintenance;
