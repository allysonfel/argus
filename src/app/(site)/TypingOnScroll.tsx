"use client";

import { useEffect, useRef, useState } from "react";

// Máquina de escrever que dispara só 1 vez, quando o elemento entra na
// tela (IntersectionObserver) — sem loop, sem redigitar de novo.
const TYPE_SPEED_MS = 35;

export default function TypingOnScroll({
  text,
  className,
  as: Tag = "h2",
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2";
}) {
  const [display, setDisplay] = useState("");
  const ref = useRef<HTMLHeadingElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !startedRef.current) {
          startedRef.current = true;
          let i = 0;
          const tick = () => {
            i++;
            setDisplay(text.slice(0, i));
            if (i < text.length) setTimeout(tick, TYPE_SPEED_MS);
          };
          tick();
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <Tag ref={ref} className={className}>
      <span aria-hidden>{display}</span>
      <span className="sr-only">{text}</span>
    </Tag>
  );
}
