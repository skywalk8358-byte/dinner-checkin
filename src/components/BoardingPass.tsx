"use client";

import QRCode from "react-qr-code";
import { useOrigin } from "@/lib/client";
import { fmtDateEn, fmtTime } from "@/lib/format";
import type { Attendee, Flight } from "@/lib/types";
import { MEAL_LABEL, splitSeat } from "@/lib/types";

function Field({ label, value, big = false, className = "" }: {
  label: string;
  value: React.ReactNode;
  big?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">{label}</div>
      <div className={`font-semibold leading-tight ${big ? "text-3xl" : "text-xl"}`}>{value}</div>
    </div>
  );
}

/** 登機證本體 —— 純呈現元件，列印與截圖都以它為準 */
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
    ? { label: "STANDBY / 候補", bg: "#8a93a8" }
    : isVip
      ? { label: "VIP TABLE / 主桌", bg: "#b8912f" }
      : { label: "DINNER CLASS / 一般席", bg: "#2f7f8a" };

  const seatDisplay = attendee.seat ?? (isStandby ? "STBY" : "—");
  const boardingAt = new Date(new Date(flight.departAt).getTime() - flight.boardingMinutes * 60_000).toISOString();

  return (
    <div className={`ticket ${animate ? "ticket-in" : ""}`}>
      <div className="grid md:grid-cols-[1fr_252px]">
        {/* ── 主票 ── */}
        <div className="relative">
          <div className="flex items-center justify-between bg-ink px-5 py-2.5 text-paper">
            <span className="text-lg font-bold tracking-[0.2em]">✈ DINNER AIR</span>
            <span className="text-xs font-semibold tracking-[0.25em]">BOARDING PASS · 登機證</span>
          </div>
          <div
            className="px-5 py-1 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-paper"
            style={{ background: klass.bg }}
          >
            {klass.label}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 sm:grid-cols-4">
            <Field
              label="Passenger / 乘客"
              value={
                <>
                  {attendee.name}
                  {attendee.dept && <span className="ml-2 text-sm font-medium text-ink-soft">{attendee.dept}</span>}
                </>
              }
              className="col-span-2"
            />
            <Field label="Flight / 航班" value={flight.code} />
            <Field label="Date / 日期" value={fmtDateEn(flight.departAt)} />

            <Field
              label="From → To / 行程"
              value={
                <span className="text-lg">
                  {flight.origin} <span className="mx-1 text-ink-soft">✈</span> {flight.venueName}
                </span>
              }
              className="col-span-2"
            />
            <Field label="Boarding / 入場" value={fmtTime(boardingAt)} />
            <Field label="Departs / 開席" value={fmtTime(flight.departAt)} />

            <Field label="Gate / 登機門" value={flight.gate} className="col-span-2" />
            <Field label="Seat / 座位" value={seatDisplay} big />
            <Field label="Meal / 餐點" value={MEAL_LABEL[attendee.meal].zh} />
          </div>

          <div className="px-5 pb-5">
            <div className="barcode" />
            <div className="mt-1 text-center text-[10px] tracking-[0.35em] text-ink-soft">
              {attendee.passToken}
            </div>
          </div>

          {attendee.checkedInAt && (
            <div className="stamp left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg">
              BOARDED
              <div className="text-xs tracking-[0.3em]">已登機 {fmtTime(attendee.checkedInAt)}</div>
            </div>
          )}
        </div>

        {/* ── 票根 ── */}
        <div className="ticket-stub relative">
          <div className="perf-h absolute inset-x-4 top-0 md:hidden" />
          <div className="perf-v absolute inset-y-4 left-0 hidden md:block" />

          <div className="flex h-full flex-col gap-3 p-5 md:pl-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold tracking-[0.2em]">✈ DINNER AIR</span>
              <span className="text-xs font-semibold text-ink-soft">{flight.code}</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-soft">Passenger</div>
                <div className="text-lg font-semibold leading-tight">{attendee.name}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-soft">Seat</div>
                <div className="text-2xl font-bold leading-tight">{seatDisplay}</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm font-medium text-ink-soft">
              <span>{fmtDateEn(flight.departAt)}</span>
              <span>{fmtTime(flight.departAt)}</span>
              <span>GATE {flight.gate.split(" ")[0]}</span>
            </div>
            <div className="mt-auto flex flex-col items-center gap-1.5">
              <div className="rounded-lg bg-white p-2.5">
                <QRCode value={passUrl} size={132} fgColor="#1d2b4e" bgColor="#ffffff" />
              </div>
              <div className="text-[10px] tracking-[0.25em] text-ink-soft">入場請出示 QR CODE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
