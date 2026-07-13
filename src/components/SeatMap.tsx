"use client";

import type { Attendee, Flight, TableConfig } from "@/lib/types";
import { SEAT_LETTERS, tableSeatCodes } from "@/lib/types";

/**
 * 圓桌座位圖：一張桌子一個圓盤，座位繞桌排列。
 * 座位代號 = 桌號 + 字母（3F = 第 3 桌 F 位），跟機票的 12A 同一種語言。
 * 已入座的座位會標出乘客姓名；點擊可由 onPeek 顯示姓名＋產業。
 */
export function SeatMap({ flight, taken, selected = [], onSelect, onPeek }: {
  flight: Flight;
  taken: Map<string, Attendee>;
  /** 已選的座位（群組報名會一次選多個） */
  selected?: string[];
  onSelect?: (code: string) => void;
  onPeek?: (code: string, attendee: Attendee) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {flight.tables.map((t) => (
        <TableDisc key={t.label} table={t} taken={taken} selected={selected} onSelect={onSelect} onPeek={onPeek} />
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
      <span className="flex items-center gap-1.5"><Dot cls="seat-taken" /> 已有人（點擊看是誰）</span>
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

/** 座位圖上的名字標籤：太長就截斷（中文名幾乎都放得下） */
function shortName(name: string): string {
  return name.length > 5 ? `${name.slice(0, 5)}…` : name;
}

function TableDisc({ table, taken, selected, onSelect, onPeek }: {
  table: TableConfig;
  taken: Map<string, Attendee>;
  selected: string[];
  onSelect?: (code: string) => void;
  onPeek?: (code: string, attendee: Attendee) => void;
}) {
  const codes = tableSeatCodes(table);
  const cx = 155; // 圓心（viewBox 加寬，讓左右側的名字放得下）
  const cy = 125;
  const seatRadius = 80;
  const nameOffset = 30; // 名字沿座位向外的距離
  const takenCount = codes.filter((code) => taken.has(code)).length;

  return (
    <div className="card p-3">
      <svg viewBox="0 0 310 250" className="w-full select-none">
        <circle
          cx={cx}
          cy={cy}
          r={50}
          fill="#fafafc"
          stroke={table.vip ? "#b8892e" : "#d9d9e0"}
          strokeWidth={table.vip ? 2.5 : 1.5}
        />
        <text x={cx} y={113} textAnchor="middle" fill={table.vip ? "#b8892e" : "#85868d"} fontSize="11" letterSpacing="2">
          TABLE
        </text>
        <text x={cx} y={139} textAnchor="middle" fill={table.vip ? "#b8892e" : "#17181c"} fontSize="24" fontWeight="700">
          {table.label}
        </text>
        {table.vip && (
          <text x={cx} y={157} textAnchor="middle" fill="#b8892e" fontSize="10" letterSpacing="3">
            VIP
          </text>
        )}

        {codes.map((code, i) => {
          const angle = ((-90 + (360 / codes.length) * i) * Math.PI) / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const x = cx + cos * seatRadius;
          const y = cy + sin * seatRadius;
          const occupant = taken.get(code);
          const isSelected = selected.includes(code);
          const cls = isSelected ? "seat-selected" : occupant ? "seat-taken" : "seat-free";
          const clickable = occupant ? !!onPeek : !!onSelect;
          const handle = () => {
            if (occupant) onPeek?.(code, occupant);
            else onSelect?.(code);
          };
          // 名字放在座位外側：偏水平的座位靠左右對齊，偏垂直的置中，避免壓到座位圓圈
          const nameAnchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
          return (
            <g key={code} onClick={clickable ? handle : undefined} style={{ cursor: clickable ? "pointer" : "default" }}>
              <title>
                {occupant ? `${code} ${occupant.name}${occupant.industry ? ` · ${occupant.industry}` : ""}` : `座位 ${code}`}
              </title>
              <circle cx={x} cy={y} r={16} className={cls} strokeWidth={1.5} />
              <text
                x={x}
                y={y + 4.5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill={isSelected ? "#ffffff" : occupant ? "#ababb2" : "#17181c"}
                style={{ pointerEvents: "none" }}
              >
                {SEAT_LETTERS[i]}
              </text>
              {occupant && (
                <text
                  x={x + cos * nameOffset}
                  y={y + sin * nameOffset + 3.5}
                  textAnchor={nameAnchor}
                  fontSize="10"
                  fontWeight="500"
                  fill="#6f7076"
                  style={{ pointerEvents: "none" }}
                >
                  {shortName(occupant.name)}
                </text>
              )}
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
