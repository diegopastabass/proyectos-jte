interface StatusLedProps {
  status: number;
  /** Texto visible junto al punto (el estado nunca depende solo del color) */
  onLabel?: string;
  offLabel?: string;
}

function StatusLed({ status, onLabel = "Regando", offLabel = "Detenido" }: StatusLedProps) {
  const on = status === 1;
  return (
    <span className={`status ${on ? "status--on" : "status--off"}`}>
      <span className="status__dot" aria-hidden="true" />
      {on ? onLabel : offLabel}
    </span>
  );
}

export default StatusLed;
