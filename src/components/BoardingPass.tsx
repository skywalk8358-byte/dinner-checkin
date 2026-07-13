"use client";

import QRCode from "react-qr-code";
import { useOrigin } from "@/lib/client";
import { fmtDateShort, fmtTime } from "@/lib/format";
import type { Attendee, Flight } from "@/lib/types";
import { splitSeat } from "@/lib/types";

function Field({ label, value, className = "" }: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-sub text-[11px] font-medium tracking-wide">{label}</div>
      <div className="mt-0.5 text-[16px] font-semibold leading-snug">{value}</div>
    </div>
  );
}

/** 登機證本體 —— Apple Wallet 風格的直式票卡，列印與截圖都以它為準 */
export function BoardingPass({ flight, attendee, animate = false }: {
  flight: Flight;
  attendee: Attendee;
  animate?: boolean;
}) {
  const origin = useOrigin();
  const passUrl = origin ? `${origin}/pass/${attendee.passToken}` : attendee.passToken;

  const isStandby = attendee.status === "standby";
  const seatTable = attendee.seat ? splitSeat(attendee.seat).table : null;
  const isVip = !!flight.tables.find((t) => t.label === seatTable)?.vip;

  const klass = isStandby
    ? { label: "候補 STANDBY", pill: "pill-warn" }
    : isVip
      ? { label: "主桌 VIP", pill: "pill-gold" }
      : { label: "一般席", pill: "pill-accent" };

  const seatDisplay = attendee.seat ?? (isStandby ? "候補" : "—");
  const boardingAt = new Date(new Date(flight.departAt).getTime() - flight.boardingMinutes * 60_000).toISOString();

  return (
    <div className={`ticket mx-auto w-full max-w-[420px] ${animate ? "ticket-in" : ""}`}>
      <div className="relative px-6 pb-6 pt-5">
        {/* 頁首 */}
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-bold tracking-tight">
            <span className="text-accent">✈</span> Dinner Air
          </span>
          <span className={`pill ${klass.pill}`}>{klass.label}</span>
        </div>

        {/* 行程 */}
        <div className="mt-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[24px] font-extrabold tracking-tight">{flight.origin}</div>
            <div className="text-sub mt-0.5 text-[12px]">出發地</div>
          </div>
          <span className="text-accent mt-2 shrink-0 text-[18px]">✈</span>
          <div className="min-w-0 text-right">
            <div className="text-[24px] font-extrabold leading-tight tracking-tight">{flight.venueName}</div>
            <div className="text-sub mt-0.5 truncate text-[12px]">{flight.title}</div>
          </div>
        </div>

        {/* 欄位 */}
        <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-4 border-t border-line pt-5">
          <Field
            label="乘客 PASSENGER"
            value={
              <>
                {attendee.name}
                {attendee.industry && (
                  <span className="text-sub ml-1.5 text-[13px] font-normal">{attendee.industry}</span>
                )}
              </>
            }
            className="col-span-2"
          />
          <Field
            label="座位 SEAT"
            value={<span className="text-accent text-[26px] font-extrabold leading-none">{seatDisplay}</span>}
          />
          <Field label="日期 DATE" value={fmtDateShort(flight.departAt)} />
          <Field label="入場 BOARDING" value={fmtTime(boardingAt)} />
          <Field label="開席 DEPARTS" value={fmtTime(flight.departAt)} />
          <Field label="登機門 GATE" value={flight.gate} className="col-span-2" />
          <Field label="航班 FLIGHT" value={flight.code} />
        </div>

        {attendee.checkedInAt && (
          <div className="stamp right-5 top-24 text-[15px]">
            BOARDED
            <div className="text-[11px] font-semibold tracking-wide">已登機 {fmtTime(attendee.checkedInAt)}</div>
          </div>
        )}
      </div>

      {/* 撕線 + QR 票根 */}
      <div className="perf" />
      <div className="flex flex-col items-center gap-2 px-6 pb-7 pt-6">
        <QRCode value={passUrl} size={164} fgColor="#17181c" bgColor="#ffffff" />
        <div className="text-sub mt-1 text-[12px] font-medium tracking-widest">{attendee.passToken}</div>
        <div className="text-sub text-[12px]">入場請出示 QR CODE</div>
      </div>
    </div>
  );
}
