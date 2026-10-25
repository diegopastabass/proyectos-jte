interface CardProps {
  title?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function Card({ title, subtitle, actions, className = "", children }: CardProps) {
  return (
    <section className={`dash-card ${className}`}>
      {(title || actions) && (
        <header className="dash-card__header">
          <div>
            {title && <h3 className="dash-card__title">{title}</h3>}
            {subtitle && <p className="dash-card__subtitle">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="dash-card__body">{children}</div>
    </section>
  );
}

export default Card;
