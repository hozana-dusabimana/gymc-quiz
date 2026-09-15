import { useEffect, useState } from 'react';

/** Full-bleed, auto-advancing crossfade carousel with a slow Ken Burns drift on each image. */
export function HeroCarousel({ images, intervalMs = 4500 }: { images: string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), intervalMs);
    return () => clearInterval(t);
  }, [images.length, intervalMs]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt="Gisozi Youth Mass Choir"
          className="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-[1800ms] ease-in-out"
          style={{
            opacity: i === index ? 0.55 : 0,
            animation: 'heroKenBurns 16s ease-in-out infinite alternate',
            animationDelay: `${i * -4}s`,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
    </div>
  );
}
