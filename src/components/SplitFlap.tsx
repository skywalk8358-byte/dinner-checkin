"use client";

import { useEffect, useRef, useState } from "react";

const CYCLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CJK_CYCLE = "█▓▒░";

/**
 * 機場翻牌看板文字：載入或內容變更時，每格字元先亂跳再依序定格。
 * 中文字用方塊字元過場（亂跳隨機漢字反而像故障）。
 */
export function Flap({
  text,
  className = "",
  cellClassName = "",
}: {
  text: string;
  className?: string;
  cellClassName?: string;
}) {
  const [chars, setChars] = useState<string[]>(() => text.split(""));
  const [settled, setSettled] = useState(false);
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (prev.current === text) return;
    prev.current = text;
    setSettled(false);

    const target = text.split("");
    let frame = 0;
    const interval = setInterval(() => {
      frame += 1;
      const done = frame > 4 + target.length * 1.2 + 3;
      setChars(
        target.map((ch, i) => {
          if (done || frame >= 4 + i * 1.2) return ch;
          if (ch === " ") return " ";
          if (ch.charCodeAt(0) > 0x2e00) return CJK_CYCLE[(frame + i) % CJK_CYCLE.length];
          return CYCLE[Math.floor(Math.random() * CYCLE.length)];
        }),
      );
      if (done) {
        clearInterval(interval);
        setSettled(true);
      }
    }, 45);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={`flap ${className}`} data-settled={settled} aria-label={text}>
      {chars.map((c, i) => (
        <span key={i} className={`flap-cell ${cellClassName}`} aria-hidden>
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}
