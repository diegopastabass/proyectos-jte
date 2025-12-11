import React, { useState } from "react";

interface MenuItem {
  label: string;
  href: string;
}

interface BurgerMenuProps {
  items: MenuItem[];
  children?: React.ReactNode; // <--- esto permite pasar cualquier cosa
}

const BurgerMenu: React.FC<BurgerMenuProps> = ({ items, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <button className="btn" onClick={toggleMenu} aria-label="Abrir menú">
        <img src="/src/assets/menu.png" alt="menu" height={16} width={16} />
      </button>

      {isOpen && <div className="menu-overlay" onClick={closeMenu}></div>}

      <div className={`burger-menu ${isOpen ? "open" : ""}`}>
        <ul className="list-unstyled m-0 p-3">
          {items.map((item, index) => (
            <li key={index} className="mb-2">
              <a
                href={item.href}
                className="text-white text-decoration-none"
                onClick={closeMenu}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Renderizar children dentro del menú */}
        {children}
      </div>
    </>
  );
};

export default BurgerMenu;
