import React, { useRef, useEffect, useCallback } from 'react';

interface Star {
  x: number;
  y: number;
  z: number; // depth layer (0-1, lower = farther)
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  life: number;
}

interface StarfieldCanvasProps {
  scrollY?: number;
}

const StarfieldCanvas: React.FC<StarfieldCanvasProps> = ({ scrollY = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const lastTimeRef = useRef(0);

  // Initialize stars
  const initStars = useCallback((width: number, height: number) => {
    const stars: Star[] = [];
    const starCount = Math.min(300, Math.floor((width * height) / 5000));

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random(), // 0 = far, 1 = close
        size: 0.5 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.5 + Math.random() * 2,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = stars;
  }, []);

  // Create explosion particles
  const createExplosion = useCallback((x: number, y: number) => {
    const colors = ['#38bdf8', '#06b6d4', '#a855f7', '#ec4899', '#f8fafc'];
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: 1 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }, []);

  // Spawn shooting star occasionally
  const maybeSpawnShootingStar = useCallback((width: number, height: number) => {
    if (Math.random() < 0.002 && shootingStarsRef.current.length < 2) {
      const startX = Math.random() * width;
      const angle = Math.PI / 4 + Math.random() * 0.5; // ~45 degrees
      shootingStarsRef.current.push({
        x: startX,
        y: -10,
        vx: Math.cos(angle) * 8,
        vy: Math.sin(angle) * 8,
        length: 80 + Math.random() * 60,
        life: 1,
      });
    }
  }, []);

  // Main render loop
  const render = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const deltaTime = Math.min((time - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = time;

    // Clear with space black
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, width, height);

    // Draw nebula gradients
    const nebulaGradient1 = ctx.createRadialGradient(
      width * 0.2, height * 0.3, 0,
      width * 0.2, height * 0.3, width * 0.5
    );
    nebulaGradient1.addColorStop(0, 'rgba(76, 29, 149, 0.15)');
    nebulaGradient1.addColorStop(0.5, 'rgba(76, 29, 149, 0.05)');
    nebulaGradient1.addColorStop(1, 'transparent');
    ctx.fillStyle = nebulaGradient1;
    ctx.fillRect(0, 0, width, height);

    const nebulaGradient2 = ctx.createRadialGradient(
      width * 0.8, height * 0.7, 0,
      width * 0.8, height * 0.7, width * 0.4
    );
    nebulaGradient2.addColorStop(0, 'rgba(30, 58, 138, 0.12)');
    nebulaGradient2.addColorStop(0.5, 'rgba(6, 182, 212, 0.04)');
    nebulaGradient2.addColorStop(1, 'transparent');
    ctx.fillStyle = nebulaGradient2;
    ctx.fillRect(0, 0, width, height);

    // Draw stars with parallax
    const parallaxOffset = scrollY * 0.3;

    starsRef.current.forEach((star) => {
      // Parallax: closer stars (higher z) move more
      const parallaxFactor = 0.2 + star.z * 0.8;
      const yOffset = (parallaxOffset * parallaxFactor) % height;
      let y = (star.y - yOffset + height) % height;

      // Twinkle effect
      const twinkle = Math.sin(time * 0.001 * star.twinkleSpeed + star.twinklePhase);
      const currentOpacity = star.opacity * (0.5 + twinkle * 0.5);
      const currentSize = star.size * (0.8 + twinkle * 0.2);

      // Draw star glow
      const gradient = ctx.createRadialGradient(
        star.x, y, 0,
        star.x, y, currentSize * 3
      );
      gradient.addColorStop(0, `rgba(248, 250, 252, ${currentOpacity})`);
      gradient.addColorStop(0.3, `rgba(56, 189, 248, ${currentOpacity * 0.3})`);
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(star.x, y, currentSize * 3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw star core
      ctx.beginPath();
      ctx.arc(star.x, y, currentSize * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(248, 250, 252, ${currentOpacity})`;
      ctx.fill();
    });

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      particle.life -= deltaTime * 1.5;

      if (particle.life <= 0) return false;

      const alpha = particle.life / particle.maxLife;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = particle.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');

      // Add glow
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      return true;
    });

    // Update and draw shooting stars
    maybeSpawnShootingStar(width, height);

    shootingStarsRef.current = shootingStarsRef.current.filter((star) => {
      star.x += star.vx;
      star.y += star.vy;
      star.life -= deltaTime * 0.8;

      if (star.life <= 0 || star.y > height + 100) return false;

      // Draw shooting star trail
      const gradient = ctx.createLinearGradient(
        star.x, star.y,
        star.x - star.vx * star.length / 8, star.y - star.vy * star.length / 8
      );
      gradient.addColorStop(0, `rgba(248, 250, 252, ${star.life})`);
      gradient.addColorStop(0.3, `rgba(56, 189, 248, ${star.life * 0.5})`);
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(
        star.x - star.vx * star.length / 8,
        star.y - star.vy * star.length / 8
      );
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();

      return true;
    });

    animationRef.current = requestAnimationFrame(render);
  }, [scrollY, maybeSpawnShootingStar]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      initStars(rect.width, rect.height);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initStars]);

  // Handle click for explosions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      createExplosion(x, y);
    };

    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [createExplosion]);

  // Track mouse for potential gravity effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Start animation loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
};

export default StarfieldCanvas;
