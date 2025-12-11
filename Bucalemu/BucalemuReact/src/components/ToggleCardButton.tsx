interface ToggleCardButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

function ToggleCardButton({ isOpen, onToggle }: ToggleCardButtonProps) {
  return (
    <button className="btn btn-link toggle-btn" onClick={onToggle}>
      {isOpen ? (
        <i className="bi bi-chevron-up"></i>
      ) : (
        <i className="bi bi-chevron-down"></i>
      )}
    </button>
  );
}

export default ToggleCardButton;
