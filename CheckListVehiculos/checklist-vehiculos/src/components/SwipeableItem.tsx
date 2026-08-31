import React, { useRef, useState, useCallback } from 'react';

interface SwipeableItemProps {
  children: React.ReactNode;
  /** Swipe RIGHT → acción izquierda (eliminar por defecto) */
  onSwipeRight?: () => void;
  /** Swipe LEFT  → acción derecha (editar por defecto) */
  onSwipeLeft?: () => void;
  rightLabel?: string;
  rightIcon?: string;
  leftLabel?: string;
  leftIcon?: string;
}

const THRESHOLD = 72;   // px para confirmar acción
const MAX_DRAG  = 120;  // px máximos de desplazamiento

const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel = 'Eliminar',
  rightIcon  = 'bi-trash-fill',
  leftLabel  = 'Editar',
  leftIcon   = 'bi-pencil-fill',
}) => {
  const startXRef  = useRef(0);
  const startYRef  = useRef(0);
  const [offset, setOffset]       = useState(0);
  const [swiping, setSwiping]     = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    setSwiping(true);
    setDirection(null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;

    // Si el movimiento es más vertical que horizontal, ignorar
    if (direction === null && Math.abs(dy) > Math.abs(dx)) {
      setSwiping(false);
      return;
    }

    if (dx > 0) {
      if (!onSwipeRight) return;
      setDirection('right');
      setOffset(Math.min(dx, MAX_DRAG));
    } else {
      if (!onSwipeLeft) return;
      setDirection('left');
      setOffset(Math.max(dx, -MAX_DRAG));
    }
  }, [swiping, direction, onSwipeRight, onSwipeLeft]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    if (offset > THRESHOLD && onSwipeRight) {
      onSwipeRight();
    } else if (offset < -THRESHOLD && onSwipeLeft) {
      onSwipeLeft();
    }
    setOffset(0);
    setDirection(null);
  }, [offset, onSwipeRight, onSwipeLeft]);

  // Opacidad del fondo proporcional al desplazamiento
  const bgOpacity = Math.min(Math.abs(offset) / THRESHOLD, 1);

  return (
    <div className="swipeable-container">
      {/* Fondo que se revela al deslizar */}
      <div className="swipeable-actions">
        {direction !== 'left' && onSwipeRight && (
          <div
            className="action-left-reveal"
            style={{ opacity: direction === 'right' ? bgOpacity : 0 }}
          >
            <i className={`bi ${rightIcon} fs-5`}></i>
            <span>{rightLabel}</span>
          </div>
        )}
        {direction !== 'right' && onSwipeLeft && (
          <div
            className="action-right-reveal"
            style={{ opacity: direction === 'left' ? bgOpacity : 0 }}
          >
            <span>{leftLabel}</span>
            <i className={`bi ${leftIcon} fs-5`}></i>
          </div>
        )}
      </div>

      {/* Contenido que se desliza */}
      <div
        className={`swipeable-content${swiping ? ' is-swiping' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableItem;
