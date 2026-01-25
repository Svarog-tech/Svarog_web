import React, { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface SectionTriangularBackgroundProps {
  opacity?: number;
}

const SectionTriangularBackground: React.FC<SectionTriangularBackgroundProps> = ({ opacity = 0.15 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      render();
    };

    const heightScale = 0.866;

    function rnd(min: number, max: number) {
      return Math.floor((Math.random() * (max - min + 1)) + min);
    }

    const render = () => {
      if (!canvas || !ctx) return;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.lineWidth = 0;

      const triSide = 40;
      const halfSide = triSide / 2;
      const rowHeight = Math.floor(triSide * heightScale);
      const columns = Math.ceil(canvasWidth / triSide) + 1;
      const rows = Math.ceil(canvasHeight / rowHeight);

      // Base color varies based on theme
      const baseHue = theme === 'dark' ? 210 : 210;
      const baseLightness = theme === 'dark' ? rnd(10, 18) : rnd(88, 96);
      const lightnessRange = theme === 'dark' ? 6 : 6;

      for (let row = 0; row < rows; row++) {
        const hue = baseHue + (row * 0.5);

        for (let col = 0; col < columns; col++) {
          let x = col * triSide;
          let y = row * rowHeight;

          if (row % 2 !== 0) {
            x -= halfSide;
          }

          // Upward pointing triangle
          const lightness1 = baseLightness + rnd(-lightnessRange, lightnessRange);
          const saturation = theme === 'dark' ? 15 : 8;
          const clr1 = `hsla(${hue}, ${saturation}%, ${lightness1}%, ${opacity})`;
          ctx.fillStyle = clr1;
          ctx.strokeStyle = clr1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + halfSide, y + rowHeight);
          ctx.lineTo(x - halfSide, y + rowHeight);
          ctx.closePath();
          ctx.fill();

          // Downward pointing triangle
          const lightness2 = baseLightness + rnd(-lightnessRange, lightnessRange);
          const clr2 = `hsla(${hue}, ${saturation}%, ${lightness2}%, ${opacity})`;
          ctx.fillStyle = clr2;
          ctx.strokeStyle = clr2;
          ctx.beginPath();
          ctx.moveTo(x, y + rowHeight);
          ctx.lineTo(x + triSide, y + rowHeight);
          ctx.lineTo(x + halfSide, y);
          ctx.closePath();
          ctx.fill();
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [theme, opacity]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
};

export default SectionTriangularBackground;
