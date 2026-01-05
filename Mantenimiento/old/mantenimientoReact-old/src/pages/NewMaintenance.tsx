import { useState, useEffect } from "react";
import {
  useForm,
  FormProvider,
  useFormContext,
  Controller,
  useFieldArray,
} from "react-hook-form";
import Loading from "./Loading";
import ErrorPage from "./Error";
import Navbar from "../components/Navbar";
import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";

type MaintenanceForm = {
  maintenance: {
    admin_id: number;
    client_id: number;
    maintainer_id: number;
    maintenance_type: string;
    scheduled_date: string;
  };
  devices: {
    device_type: string;
    serial_number: string;
    model: string;
    tasks: {
      description: string;
    }[];
  }[];
};

type UserData = {
  id: number;
  name: string;
};

export default function MaintenanceForm() {
  const methods = useForm<MaintenanceForm>({
    defaultValues: {
      maintenance: {
        admin_id: 9999,
        client_id: -1,
        maintainer_id: -1,
        maintenance_type: "",
        scheduled_date: "",
      },
      devices: [],
    },
    mode: "onChange",
  });

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = localStorage.getItem("token");

  const onSubmit = async (data: MaintenanceForm) => {
    setIsSubmitting(true);
    try {
      // Crear mantenimiento
      const maintenanceRes = await fetch(
        "http://localhost:3002/endpoints/mantenimiento/maintenances/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify(data.maintenance),
        }
      );

      if (!maintenanceRes.ok) throw new Error("Error creating maintenance");

      const maintenance = await maintenanceRes.json();

      // Crear dispositivos y sus tareas
      for (const device of data.devices) {
        const deviceRes = await fetch(
          "http://localhost:3002/endpoints/mantenimiento/devices/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
            body: JSON.stringify({
              ...device,
              maintenance_id: maintenance.insertedId,
            }),
          }
        );

        if (!deviceRes.ok) throw new Error("Error creating device");

        const deviceData = await deviceRes.json();

        // Crear tareas para este dispositivo
        for (const task of device.tasks) {
          await fetch("http://localhost:3002/endpoints/mantenimiento/tasks/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
            body: JSON.stringify({
              ...task,
              device_id: deviceData.insertedId,
            }),
          });
        }
      }

      alert("Sesión de mantenimiento creada con éxito");
      methods.reset();
      setStep(0);
    } catch (err) {
      console.error(err);
      alert("Error creando la sesión de mantenimiento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = async () => {
    let isValid = false;

    if (step === 0) {
      isValid = await methods.trigger("maintenance");
    } else if (step === 1) {
      isValid = await methods.trigger("devices");
    }

    if (isValid) {
      setStep(step + 1);
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="container-fluid p-0">
        <Navbar />

        <div className="container mt-4">
          <div className="card">
            <div className="card-header">
              <h2 className="mb-0">Nueva Sesión de Mantenimiento</h2>
              <div className="progress mt-3" style={{ height: "20px" }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${((step + 1) / 3) * 100}%` }}
                  aria-valuenow={((step + 1) / 3) * 100}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  Paso {step + 1} de 3
                </div>
              </div>
            </div>

            <div className="card-body">
              <form onSubmit={methods.handleSubmit(onSubmit)}>
                {step === 0 && <MaintenanceStep />}
                {step === 1 && <DevicesStep />}
                {step === 2 && <ReviewStep />}

                <div className="d-flex justify-content-between mt-4">
                  <div>
                    {step > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setStep(step - 1)}
                        disabled={isSubmitting}
                      >
                        Atrás
                      </button>
                    )}
                  </div>

                  <div>
                    {step < 2 ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={nextStep}
                        disabled={isSubmitting}
                      >
                        Siguiente
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="btn btn-success"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            ></span>
                            Guardando...
                          </>
                        ) : (
                          "Guardar Sesión de Mantenimiento"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}

registerLocale("es", es);

function MaintenanceStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<MaintenanceForm>();
  const [clients, setClients] = useState<UserData[]>([]);
  const [maintainers, setMaintainers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");

        const [clientsRes, maintainersRes] = await Promise.all([
          fetch("http://localhost:3002/endpoints/mantenimiento/clients/all", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
          }),
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

        if (!clientsRes.ok) throw new Error(`Error HTTP: ${clientsRes.status}`);
        if (!maintainersRes.ok)
          throw new Error(`Error HTTP: ${maintainersRes.status}`);

        const clientsData = await clientsRes.json();
        const maintainersData = await maintainersRes.json();

        if (clientsData.success) setClients(clientsData.clients);
        else setError("Error al cargar clientes");

        if (maintainersData.success) setMaintainers(maintainersData.users);
        else setError("Error al cargar mantenedores");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorPage />;

  return (
    <div>
      <h4 className="mb-4">Información General</h4>

      <div className="row">
        {/* Combobox clientes */}
        <div className="col-md-6 mb-3">
          <label className="form-label">Cliente *</label>
          <select
            className={`form-select ${
              errors.maintenance?.client_id ? "is-invalid" : ""
            }`}
            {...register("maintenance.client_id", {
              valueAsNumber: true,
              validate: (value) => value !== -1 || "Seleccione un cliente",
            })}
          >
            <option value={-1}>Seleccione un cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {errors.maintenance?.client_id && (
            <div className="invalid-feedback">
              {errors.maintenance.client_id.message}
            </div>
          )}
        </div>

        {/* Combobox mantenedores */}
        <div className="col-md-6 mb-3">
          <label className="form-label">Mantenedor *</label>
          <select
            className={`form-select ${
              errors.maintenance?.maintainer_id ? "is-invalid" : ""
            }`}
            {...register("maintenance.maintainer_id", {
              valueAsNumber: true,
              validate: (value) => value !== -1 || "Seleccione un mantenedor",
            })}
          >
            <option value={-1}>Seleccione un mantenedor</option>
            {maintainers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {errors.maintenance?.maintainer_id && (
            <div className="invalid-feedback">
              {errors.maintenance.maintainer_id.message}
            </div>
          )}
        </div>
      </div>

      <div className="row">
        {/* Tipo de mantenimiento */}
        <div className="col-md-6 mb-3">
          <label className="form-label">Tipo de Mantenimiento *</label>
          <input
            type="text"
            className={`form-control ${
              errors.maintenance?.maintenance_type ? "is-invalid" : ""
            }`}
            {...register("maintenance.maintenance_type", {
              required: "Este campo es obligatorio",
            })}
            placeholder="Falla, Preventivo, etc."
          />
          {errors.maintenance?.maintenance_type && (
            <div className="invalid-feedback">
              {errors.maintenance.maintenance_type.message}
            </div>
          )}
        </div>

        {/* Fecha programada */}
        <div className="col-md-6 mb-3">
          <label className="form-label">Fecha Programada *</label>
          <Controller
            control={control}
            name="maintenance.scheduled_date"
            rules={{ required: "Este campo es obligatorio" }}
            render={({ field, fieldState: { error } }) => (
              <div>
                <DatePicker
                  className={`form-control ${error ? "is-invalid" : ""}`}
                  selected={field.value ? new Date(field.value) : null}
                  onChange={(date: Date | null) => {
                    field.onChange(date ? date.toISOString() : "");
                  }}
                  locale="es"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Selecciona una fecha"
                />
                {error && (
                  <div className="invalid-feedback d-block">
                    {error.message}
                  </div>
                )}
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}

function DevicesStep() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<MaintenanceForm>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "devices",
  });

  const addDevice = () => {
    append({
      device_type: "",
      serial_number: "",
      model: "",
      tasks: [],
    });
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>Equipos y Tareas</h4>
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={addDevice}
        >
          + Agregar Equipo
        </button>
      </div>

      {fields.length === 0 && (
        <div className="alert alert-info">
          No hay equipos agregados. Presiona "Agregar Equipo" para comenzar.
        </div>
      )}

      {fields.map((field, index) => (
        <div key={field.id} className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Equipo {index + 1}</h5>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => remove(index)}
            >
              Eliminar
            </button>
          </div>

          <div className="card-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Tipo de dispositivo *</label>
                <input
                  type="text"
                  className={`form-control ${
                    errors.devices?.[index]?.device_type ? "is-invalid" : ""
                  }`}
                  {...register(`devices.${index}.device_type` as const, {
                    required: "Este campo es obligatorio",
                  })}
                  placeholder="Ej: Computador, Impresora, etc."
                />
                {errors.devices?.[index]?.device_type && (
                  <div className="invalid-feedback">
                    {errors.devices[index]?.device_type?.message}
                  </div>
                )}
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Número de serie</label>
                <input
                  type="text"
                  className="form-control"
                  {...register(`devices.${index}.serial_number` as const)}
                  placeholder="Número de serie del equipo"
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Modelo</label>
                <input
                  type="text"
                  className="form-control"
                  {...register(`devices.${index}.model` as const)}
                  placeholder="Modelo del equipo"
                />
              </div>
            </div>

            <DeviceTasks deviceIndex={index} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DeviceTasks({ deviceIndex }: { deviceIndex: number }) {
  const { control, register } = useFormContext<MaintenanceForm>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: `devices.${deviceIndex}.tasks`,
  });

  const addTask = () => {
    append({
      description: "",
    });
  };

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Tareas para este equipo</h6>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={addTask}
        >
          + Agregar Tarea
        </button>
      </div>

      {fields.map((field, taskIndex) => (
        <div key={field.id} className="d-flex align-items-center mb-2">
          <input
            type="text"
            className="form-control me-2"
            {...register(
              `devices.${deviceIndex}.tasks.${taskIndex}.description` as const
            )}
            placeholder="Descripción de la tarea"
          />
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => remove(taskIndex)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ReviewStep() {
  const { getValues } = useFormContext<MaintenanceForm>();
  const formData = getValues();
  const [clients, setClients] = useState<UserData[]>([]);
  const [maintainers, setMaintainers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem("token");
        const [clientsRes, maintainersRes] = await Promise.all([
          fetch("http://localhost:3002/endpoints/mantenimiento/clients/all", {
            headers: {
              Authorization: token ? `Bearer ${token}` : "",
            },
          }),
          fetch(
            "http://localhost:3002/endpoints/mantenimiento/users/byrole/2",
            {
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            }
          ),
        ]);

        const clientsData = await clientsRes.json();
        const maintainersData = await maintainersRes.json();

        if (clientsData.success) setClients(clientsData.clients);
        if (maintainersData.success) setMaintainers(maintainersData.users);
      } catch (error) {
        console.error("Error loading data for review:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <Loading />;

  const clientName =
    clients.find((c) => c.id === formData.maintenance.client_id)?.name || "N/A";
  const maintainerName =
    maintainers.find((m) => m.id === formData.maintenance.maintainer_id)
      ?.name || "N/A";

  return (
    <div>
      <h4 className="mb-4">Revisar Información</h4>

      <div className="card mb-4">
        <div className="card-header">
          <h5>Información General</h5>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Cliente:</strong> {clientName}
              </p>
              <p>
                <strong>Mantenedor:</strong> {maintainerName}
              </p>
            </div>
            <div className="col-md-6">
              <p>
                <strong>Tipo de Mantenimiento:</strong>{" "}
                {formData.maintenance.maintenance_type}
              </p>
              <p>
                <strong>Fecha Programada:</strong>{" "}
                {formData.maintenance.scheduled_date
                  ? new Date(
                      formData.maintenance.scheduled_date
                    ).toLocaleDateString("es-ES")
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5>Equipos y Tareas</h5>
        </div>
        <div className="card-body">
          {formData.devices.length === 0 ? (
            <p className="text-muted">No hay equipos agregados</p>
          ) : (
            formData.devices.map((device, index) => (
              <div key={index} className="mb-3 pb-3 border-bottom">
                <h6>Equipo {index + 1}</h6>
                <p>
                  <strong>Tipo:</strong> {device.device_type}
                </p>
                <p>
                  <strong>Número de Serie:</strong>{" "}
                  {device.serial_number || "N/A"}
                </p>
                <p>
                  <strong>Modelo:</strong> {device.model || "N/A"}
                </p>

                <h6>Tareas:</h6>
                {device.tasks.length === 0 ? (
                  <p className="text-muted ms-3">
                    No hay tareas para este equipo
                  </p>
                ) : (
                  <ul>
                    {device.tasks.map((task, taskIndex) => (
                      <li key={taskIndex}>{task.description}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
