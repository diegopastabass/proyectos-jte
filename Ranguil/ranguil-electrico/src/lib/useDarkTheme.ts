import { useEffect, useState } from "react";

// Sigue la clase "dark-theme" que aplica ToggleThemeButton sobre <body>
export const useDarkTheme = (): boolean => {
  const [dark, setDark] = useState(() =>
    document.body.classList.contains("dark-theme"),
  );

  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.body.classList.contains("dark-theme")),
    );
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return dark;
};

export const chartTheme = (dark: boolean) => ({
  text: dark ? "#dee2e6" : "#555",
  grid: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
});
