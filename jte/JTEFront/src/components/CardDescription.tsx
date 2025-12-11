import React, { useEffect, useState } from "react";

interface CardDescProps {
  url: string;
  text: string;
  text2: string;
  images: string[];
  interval?: number;
}

export function CardDesc({
  url,
  text,
  text2,
  images,
  interval = 3000,
}: CardDescProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      if (!hovered) {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [images, interval, hovered]);

  return (
    <div
      className="card h-100 shadow-sm cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => window.open(url, "_blank")}
      style={{
        overflow: "hidden",
        transition:
          "transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 6px 16px rgba(0, 0, 0, 0.15)"
          : "0 3px 8px rgba(0, 0, 0, 0.1)",
        filter: hovered ? "brightness(1.03)" : "brightness(1)",
      }}
      role="button"
    >
      <div
        className="position-relative"
        style={{
          height: "180px",
          overflow: "hidden",
        }}
      >
        {images.map((img, idx) => (
          <img
            key={idx}
            src={img}
            alt={`${text} - vista ${idx + 1}`}
            className="w-100 h-100 position-absolute top-0 start-0"
            style={{
              objectFit: "cover",
              opacity: idx === currentIndex ? 1 : 0,
              transition: "opacity 0.8s ease-in-out",
            }}
          />
        ))}
      </div>

      <div className="card-body text-center">
        <h5 className="card-title fw-semibold">{text}</h5>
        <p className="card-text text-muted small">{text2}</p>
      </div>
    </div>
  );
}
