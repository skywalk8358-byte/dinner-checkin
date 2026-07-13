"use client";

import type { Attendee, Flight, TableConfig } from "@/lib/types";
import { SEAT_LETTERS, tableSeatCodes } from "@/lib/types";

/**
 * 圓桌座位圖：一張桌子一個圓盤，座位繞桌排列。
 * 座位代號 = 桌號 + 字母（3F = 第 3 桌 F 位），跟機票的 12A 同一種語言。
 */
export function SeatMap({ flight, taken, selected, onSelect }: {
  flight: Flight;
  taken: Map<string, Attendee>;
  selected?: string;
  onSelect?: (code: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {flight.tables.map((t) => (
        <TableDisc key={t.label} table={t} taken={taken} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

function Dot({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" className={cls} strokeWidth="1.5" />
    </svg>
  );
}

export function SeatLegend() {
  return (
    <div className="text-sub flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
      <span className="flex items-center gap-1.5"><Dot cls="seat-free" /> 可選</span>
      <span className="flex items-center gap-1.5"><Dot cls="seat-taken" /> 已有人</span>
      <span className="flex items-center gap-1.5"><Dot cls="seat-selected" /> 你的選擇</span>
      <span className="flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <circle cx="12" cy="12" r="9" fill="none" stroke="#b8892e" strokeWidth="2" />
        </svg>
        VIP 主桌
      </span>
    </div>
  );
}

function TableDisc({ table, taken, selected, onSelect }: {
  table: TableConfig;
  taken: Map<string, Attendee>;
  selected?: string;
  onSelect?: (code: string) => void;
}) {
  const codes = tableSeatCodes(table);
  const cx = 110;
  const cy = 110;
  const radius = 84;
  const takenCount = codes.filter((c) => taken.has(c)).length;

  return (
    <div className="card p-3">
      <svg viewBox="0 0 220 220" className="w-full select-none">
        <circle
          cx={cx}
          cy={cy}
          r={52}
          fill="#fafafc"
          stroke={table.vip ? "#b8892e" : "#d9d9e0"}
          strokeWidth={table.vip ? 2.5 : 1.5}
        />
        <text x={cx} y={98} textAnchor="middle" fill={table.vip ? "#b8892e" : "#85868d"} fontSize="11" letterSpacing="2">
          TABLE
        </text>
        <text x={cx} y={124} textAnchor="middle" fill={table.vip ? "#b8892e" : "#17181c"} fontSize="24" fontWeight="700">
          {table.label}
        </text>
        {table.vip && (
          <text x={cx} y={142} textAnchor="middle" fill="#b8892e" fontSize="10" letterSpacing="3">
            VIP
          </text>
        )}

        {codes.map((code, i) => {
          const angle = ((-90 + (360 / codes.length) * i) * Math.PI) / 180;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const isTaken = taken.has(code);
          const isSelected = selected === code;
          const cls = isSelected ? "seat-selected" : isTaken ? "seat-taken" : "seat-free";
          const clickable = !isTaken && !!onSelect;
          return (
            <g
              key={code}
              onClick={() => clickable && onSelect(code)}
              style={{ cursor: isTaken ? "not-allowed" : clickable ? "pointer" : "default" }}
            >
              <title>{isTaken ? `${code} 已被選走` : `座位 ${code}`}</title>
              <circle cx={x} cy={y} r={16} className={cls} strokeWidth={1.5} />
              <text
                x={x}
                y={y + 4.5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill={isSelected ? "#ffffff" : isTaken ? "#ababb2" : "#17181c"}
                style={{ pointerEvents: "none" }}
              >
                {SEAT_LETTERS[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="text-sub mt-1 flex justify-between px-1 text-[12px]">
        <span>第 {table.label} 桌{table.vip ? " · VIP" : ""}</span>
        <span>
          {takenCount}/{table.seats}
        </span>
      </div>
    </div>
  );
}
