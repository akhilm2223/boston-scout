import { useEffect, useRef } from 'react';
import './WeatherOverlay.css';

interface WeatherOverlayProps {
  weather: 'clear' | 'rain' | 'snow' | 'fog';
}

export default function WeatherOverlay({ weather }: WeatherOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number;
      y: number;
      speed: number;
      size: number;
      opacity: number;
      drift: number;
    }> = [];

    const particleCount = weather === 'rain' ? 300 : weather === 'snow' ? 150 : 0;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: weather === 'rain' ? 15 + Math.random() * 10 : 1 + Math.random() * 2,
        size: weather === 'rain' ? 1 : 2 + Math.random() * 3,
        opacity: 0.3 + Math.random() * 0.5,
        drift: weather === 'snow' ? (Math.random() - 0.5) * 2 : 0,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (weather === 'rain') {
        ctx.strokeStyle = 'rgba(150, 200, 255, 0.4)';
        ctx.lineWidth = 1;

        particles.forEach((p) => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 1, p.y + 15);
          ctx.stroke();

          p.y += p.speed;
          p.x += 1;

          if (p.y > canvas.height) {
            p.y = -20;
            p.x = Math.random() * canvas.width;
          }
        });
      } else if (weather === 'snow') {
        particles.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.fill();

          p.y += p.speed;
          p.x += p.drift + Math.sin(p.y * 0.01) * 0.5;

          if (p.y > canvas.height) {
            p.y = -10;
            p.x = Math.random() * canvas.width;
          }
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    if (weather === 'rain' || weather === 'snow') {
      animate();
    }

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [weather]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`weather-canvas ${weather !== 'clear' ? 'active' : ''}`}
      />
      {weather === 'fog' && <div className="fog-overlay" />}
      {weather === 'rain' && <div className="rain-ambient" />}
    </>
  );
}
