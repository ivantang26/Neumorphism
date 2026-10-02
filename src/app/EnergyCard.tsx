import { useState } from "react";
import { LightningIcon as Lightning } from "@phosphor-icons/react/ssr";
import type { HomeState } from "~/lib/home";
import { Card } from "~/ui/Card";
import styles from "./EnergyCard.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Heating energy for the last seven days, in kWh (tariff data is out of scope for
 * v1, so no pounds; see README open questions). One series, one hue; the title
 * names it, so there is no legend. Hover or focus a bar for its value; the same
 * numbers are in a table for screen readers and for "Show as table".
 */
export function EnergyCard({ home }: { home: HomeState }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const days = home.energy.map((kwh, i) => {
    const dow = (home.energyEndDay - (home.energy.length - 1 - i) + 70) % 7;
    return { kwh, short: DAYS[dow], long: DAY_NAMES[dow], today: i === home.energy.length - 1 };
  });
  const total = days.reduce((s, d) => s + d.kwh, 0);
  const max = Math.max(...days.map((d) => d.kwh), 1);
  const niceMax = Math.ceil(max / 5) * 5;
  const avg = total / days.length;
  const today = days[days.length - 1];

  // Chart geometry
  const W = 320;
  const H = 150;
  const top = 12;
  const bottom = 24;
  const left = 4;
  const plotH = H - top - bottom;
  const slot = (W - left) / days.length;
  const barW = Math.min(26, slot - 10);
  const y = (v: number) => top + plotH - (v / niceMax) * plotH;

  return (
    <Card as="section" aria-labelledby="energy-title" className={styles.card}>
      <div className={styles.head}>
        <h2 id="energy-title" className={styles.title}>
          <Lightning weight="bold" aria-hidden="true" /> Heating energy, last 7 days
        </h2>
      </div>
      <p className={styles.total}>
        <span className="tabular">{total.toFixed(1)}</span> <span className={styles.unit}>kWh</span>
      </p>
      <p className={styles.sub}>
        Today so far <strong className="tabular">{today.kwh.toFixed(1)} kWh</strong>. Daily average{" "}
        <span className="tabular">{avg.toFixed(1)} kWh</span>.
      </p>

      {!asTable && (
        <div className={styles.chartWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-labelledby="energy-title energy-desc">
            <desc id="energy-desc">
              {days.map((d) => `${d.long}${d.today ? " (today)" : ""} ${d.kwh.toFixed(1)} kWh`).join(", ")}
            </desc>
            {[0.5, 1].map((f) => (
              <line key={f} x1={0} x2={W} y1={y(niceMax * f)} y2={y(niceMax * f)} className={styles.grid} />
            ))}
            <text x={W} y={y(niceMax) - 3} textAnchor="end" className={styles.axis}>
              {niceMax} kWh
            </text>
            <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} className={styles.baseline} />
            {days.map((d, i) => {
              const cx = left + slot * i + slot / 2;
              const bh = Math.max(2, top + plotH - y(d.kwh));
              const bx = cx - barW / 2;
              const by = top + plotH - bh;
              const r = Math.min(4, barW / 2, bh);
              return (
                <g key={i} data-today={d.today || undefined} data-hover={hover === i || undefined}>
                  {/* 4px rounded data end, square at the baseline */}
                  <path
                    className={styles.bar}
                    d={`M${bx},${top + plotH} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + barW - r} Q${bx + barW},${by} ${bx + barW},${by + r} V${top + plotH} Z`}
                  />
                  <text x={cx} y={H - 6} textAnchor="middle" className={styles.day}>
                    {d.today ? "Today" : d.short}
                  </text>
                  {/* Hit target: the whole column, bigger than the bar */}
                  <rect
                    x={left + slot * i}
                    y={0}
                    width={slot}
                    height={top + plotH}
                    fill="transparent"
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div
              className={styles.tip}
              style={{ left: `${((left + slot * hover + slot / 2) / W) * 100}%` }}
              aria-hidden="true"
            >
              <strong>{days[hover].today ? "Today" : days[hover].long}</strong>
              <span className="tabular">{days[hover].kwh.toFixed(1)} kWh</span>
            </div>
          )}
        </div>
      )}

      <table className={asTable ? styles.table : "visually-hidden"}>
        <caption className="visually-hidden">Heating energy per day, in kilowatt hours</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">kWh</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.today ? `${d.long} (today)` : d.long}</th>
              <td className="tabular">{d.kwh.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className={styles.switch} onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
        {asTable ? "Show as chart" : "Show as table"}
      </button>
    </Card>
  );
}
