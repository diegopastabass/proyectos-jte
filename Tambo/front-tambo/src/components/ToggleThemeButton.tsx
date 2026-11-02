import React, { useState, useEffect } from "react";

export const ToggleThemeButton: React.FC = () => {
  const [isDarkTheme, setIsDarkTheme] = useState(
    () => localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    if (isDarkTheme) {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
    localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
  }, [isDarkTheme]);

  const handleToggle = () => {
    setIsDarkTheme((prevTheme) => !prevTheme);
  };

  return (
    <button className="btn btn-primary " onClick={handleToggle}>
      {isDarkTheme ? "☀️" : "🌙"}
    </button>
  );
};
