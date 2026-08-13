import { useAuth } from '../context/AuthContext';
import Main_1 from '../assets/Main_1.mp4';
import { useRef, useState, useEffect } from 'react';

export default function WelcomePage() {
  const { user } = useAuth();
  const cardRef = useRef(null);
  const [transform, setTransform] = useState('rotateX(0deg) rotateY(0deg)');
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [entered, setEntered] = useState(false);

  // Pokreće ulaznu animaciju
  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseMove = (e) => {
    if (!cardRef.current || !entered) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;

    setTransform(`rotateX(${rotateX}deg) rotateY(${rotateY}deg)`);
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.25,
    });
  };

  const handleMouseLeave = () => {
    setTransform('rotateX(0deg) rotateY(0deg)');
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={Main_1} type="video/mp4" />
      </video>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/45" />

      {/* 3D Card */}
      <div
        className="relative z-10 perspective-[1200px]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={cardRef}
          style={{
            transform: entered
              ? transform
              : 'rotateY(95deg) scale(0.9)',
            opacity: entered ? 1 : 0,
            transition: entered
              ? 'transform 0.15s ease-out'
              : 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease',
          }}
          className="relative w-[340px] sm:w-[420px] md:w-[480px] rounded-3xl border border-white/20 bg-white/10 p-10 md:p-12 shadow-2xl backdrop-blur-xl"
        >
          {/* Glare effect */}
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}) 0%, transparent 60%)`,
            }}
          />

          {/* Sadržaj kartice */}
          <div className="relative z-10 text-center">
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white"
              style={{
                textShadow: `
                  0 2px 4px rgba(0,0,0,0.4),
                  0 4px 12px rgba(0,0,0,0.35),
                  0 8px 24px rgba(0,0,0,0.3),
                  0 0 70px rgba(243, 220, 9, 0.15)
                `,
                opacity: entered ? 1 : 0,
                transform: entered ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.6s ease 0.35s, transform 0.6s ease 0.35s',
              }}
            >
              Welcome, {user?.name}
            </h1>

            {/* Dekorativna linija */}
            <div
              className="mt-6 mx-auto h-px w-20 bg-gradient-to-r from-transparent via-white/70 to-transparent"
              style={{
                opacity: entered ? 1 : 0,
                transform: entered ? 'scaleX(1)' : 'scaleX(0)',
                transition: 'opacity 0.5s ease 0.55s, transform 0.5s ease 0.55s',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}