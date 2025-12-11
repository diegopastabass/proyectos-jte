interface ToggleCardButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

function ToggleCardButton({ isOpen, onToggle }: ToggleCardButtonProps) {
  return (
    <button className="btn btn-link toggle-btn" onClick={onToggle}>
      {isOpen ? "▲" : "▼"}
    </button>
  );
}

export default ToggleCardButton;
