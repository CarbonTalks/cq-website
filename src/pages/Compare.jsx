import React, { useState } from 'react';
import { useApp } from '../state.jsx';
import { fmt } from '../live-data.js';
import { useT } from '../i18n.jsx';

// FIFO and CarbonQueue review the same files with the same total effort; only the order differs.
// This view shows both orders side by side and how much carbon each has reviewed as the work proceeds.
const FIFO_COLOR = '#2a78d6', CQ_COLOR = '#1baf7a';  // validated pair (dataviz validator, light surface)
const MAX_SLOPE_ROWS = 30;
const carbonOf = p => p.carbon?.[1] || 0;

function progress(order) {
  let hours = 0, carbon = 0;
  return [{ hours: 0, carbon: 0, p: null }, ...order.map(p => {
    hours += p.effort || 0; carbon += carbonOf(p);
    return { hours, carbon, p };
  })];
}
const carbonBy = (steps, hours) => steps.filter(s => s.hours <= hours + 1e-9).at(-1).carbon;
// Carbon-weighted wait: reviewer hours spent before each project's review ends, weighted by its daily tCO2e.
// It needs no cut-off point: how long, on average, each tonne of daily impact waits for its review.
const carbonWeightedWait = steps => {
  const total = steps.at(-1).carbon;
  return total > 0 ? steps.slice(1).reduce((sum, s) => sum + carbonOf(s.p) * s.hours, 0) / total : 0;
};

function Stat({ label, value, note }) {
  return <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm flex flex-col gap-1">
    <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-medium">{label}</span>
    <span className="font-metric-num text-metric-num text-on-surface">{value}</span>
    <span className="font-label-xs text-label-xs text-on-surface-variant">{note}</span>
  </div>;
}

function Slope({ fifo, cq }) {
  const { t } = useT();
  const [hover, setHover] = useState(null);
  const row = 34, top = 30, w = 960, colW = 360, height = top + fifo.length * row + 8;
  const y = i => top + i * row + row / 2;
  const cqIndex = Object.fromEntries(cq.map((p, i) => [p.applicationId || p.id, i]));
  const label = (p, rank) => `${rank}. ${p.name.length > 34 ? p.name.slice(0, 33) + '…' : p.name}`;
  return <svg viewBox={`0 0 ${w} ${height}`} role="img" className="compare-slope"
    aria-label={t('Review order under FIFO and under CarbonQueue')}>
    <text x="0" y="16" className="compare-head" fill={FIFO_COLOR}>{t('FIFO · submission order')}</text>
    <text x={w} y="16" textAnchor="end" className="compare-head" fill="#0e7a55">{t('CarbonQueue order')}</text>
    {fifo.map((p, i) => {
      const key = p.applicationId || p.id, j = cqIndex[key], up = j < i, active = hover === key;
      const moved = i - j;
      return <g key={key} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} opacity={hover && !active ? 0.25 : 1}>
        <title>{`${p.name}: FIFO #${i + 1} → CarbonQueue #${j + 1} · ${fmt(carbonOf(p))} tCO₂e/${t('day')} · ${fmt(p.effort, 0)} ${t('h')}`}</title>
        <rect x="0" y={y(i) - row / 2} width={w} height={row} fill="transparent" />
        <text x="0" y={y(i) + 4} className="compare-name">{label(p, i + 1)}</text>
        <text x={colW - 8} y={y(i) + 4} textAnchor="end" className="compare-value">{fmt(carbonOf(p))}</text>
        <line x1={colW} y1={y(i)} x2={w - colW} y2={y(j)} stroke={up ? CQ_COLOR : '#c3c9d4'} strokeWidth={active ? 3.5 : up ? 2.5 : 1.5} />
        <circle cx={colW} cy={y(i)} r="4" fill={FIFO_COLOR} stroke="#fff" strokeWidth="2" />
        <circle cx={w - colW} cy={y(j)} r="4" fill={CQ_COLOR} stroke="#fff" strokeWidth="2" />
        {moved !== 0 && <text x={w - colW + 12} y={y(j) + 4} className="compare-move" fill={up ? '#0e7a55' : '#626875'}>{up ? `▲ ${moved}` : `▼ ${-moved}`}</text>}
      </g>;
    })}
    {cq.map((p, j) => <text key={p.applicationId || p.id} x={w} y={y(j) + 4} textAnchor="end" className="compare-name">{label(p, j + 1)}</text>)}
  </svg>;
}

function Cumulative({ fifo, cq, budget }) {
  const { t } = useT();
  const total = fifo.at(-1).hours || 1, max = Math.max(1, fifo.at(-1).carbon);
  const W = 960, H = 300, L = 56, R = 24, T = 18, B = 40;
  const x = h => L + h / total * (W - L - R), y = c => T + (1 - c / max) * (H - T - B);
  const path = steps => steps.map((s, i) => i === 0 ? `M${x(0)},${y(0)}` : `H${x(s.hours)}V${y(s.carbon)}`).join('');
  const atCq = carbonBy(cq, budget), atFifo = carbonBy(fifo, budget);
  const ticks = [0, .25, .5, .75, 1];
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" className="compare-chart"
    aria-label={t('Daily tCO₂e of the projects already reviewed, by reviewer hours spent')}>
    {ticks.map(f => <g key={f}><line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="#e8edf1" />
      <text x={L - 8} y={y(max * f) + 4} textAnchor="end" className="compare-axis">{fmt(max * f, max < 20 ? 1 : 0)}</text></g>)}
    {ticks.map(f => <text key={'x' + f} x={x(total * f)} y={H - 18} textAnchor="middle" className="compare-axis">{fmt(total * f, 0)} {t('h')}</text>)}
    <text x={W - R} y={H - 2} textAnchor="end" className="compare-axis">{t('Reviewer hours spent')}</text>
    <line x1={x(budget)} x2={x(budget)} y1={T} y2={H - B} stroke="#76777d" strokeDasharray="4 4" />
    <text x={x(budget) + 6} y={T + 12} className="compare-axis">{t('First third of the work')}</text>
    <path d={path(fifo)} fill="none" stroke={FIFO_COLOR} strokeWidth="2.5" />
    <path d={path(cq)} fill="none" stroke={CQ_COLOR} strokeWidth="2.5" />
    {fifo.length <= MAX_SLOPE_ROWS + 1 && [[fifo, FIFO_COLOR, 'FIFO'], [cq, CQ_COLOR, 'CarbonQueue']].map(([steps, color, name]) => steps.slice(1).map(s =>
      <circle key={name + s.hours} cx={x(s.hours)} cy={y(s.carbon)} r="4" fill={color} stroke="#fff" strokeWidth="2">
        <title>{`${name}: ${s.p.name} · ${fmt(s.hours, 0)} ${t('h')} → ${fmt(s.carbon)} tCO₂e/${t('day')}`}</title></circle>))}
    <text x={x(budget) + 8} y={y(atCq) - 8} className="compare-label">CarbonQueue {fmt(atCq)}</text>
    <text x={x(budget) + 8} y={y(atFifo) + 16} className="compare-label">FIFO {fmt(atFifo)}</text>
  </svg>;
}

export default function Compare() {
  const ctx = useApp();
  const { t } = useT();
  const rows = ctx.rows.filter(p => p.position?.fifo && p.position?.carbonqueue);
  if (!rows.length) return null;
  const fifoOrder = [...rows].sort((a, b) => a.position.fifo - b.position.fifo);
  const cqOrder = [...rows].sort((a, b) => a.position.carbonqueue - b.position.carbonqueue);
  const fifo = progress(fifoOrder), cq = progress(cqOrder);
  const totalHours = fifo.at(-1).hours, totalCarbon = fifo.at(-1).carbon;
  const budget = totalHours / 3;
  const atCq = carbonBy(cq, budget), atFifo = carbonBy(fifo, budget);
  const waitCq = carbonWeightedWait(cq), waitFifo = carbonWeightedWait(fifo);
  const capacity = ctx.live.data?.calibration?.capacity_hours_per_week;
  const inWeeks = capacity && totalHours > capacity;
  const waitText = h => inWeeks ? `${fmt(h / capacity, 1)} ${t('weeks')}` : `${fmt(h, 0)} ${t('h')}`;
  const biggest = [...rows].sort((a, b) => carbonOf(b) - carbonOf(a)).slice(0, 3).filter(p => carbonOf(p) > 0);
  return <div className="flex flex-col gap-space-md">
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
      <Stat label={t('Carbon reviewed in the first third of the work')}
        value={atFifo > 0 ? `×${fmt(atCq / atFifo, 1)}` : fmt(atCq)}
        note={t('CarbonQueue {a} vs FIFO {b} tCO₂e/day after {h} reviewer hours', { a: fmt(atCq), b: fmt(atFifo), h: fmt(budget, 0) })} />
      <Stat label={t('Carbon-weighted wait')}
        value={waitFifo > 0 ? `−${fmt((1 - waitCq / waitFifo) * 100, 0)}%` : '—'}
        note={t('Each tCO₂e/day waits {a} instead of {b} for its review ({u})', { a: waitText(waitCq), b: waitText(waitFifo), u: inWeeks ? t('at the calibrated weekly capacity') : t('reviewer hours of work before it') })} />
      <Stat label={t('Largest projects')}
        value={biggest.map(p => `#${p.position.carbonqueue}`).join(' · ')}
        note={t('Their place under FIFO: {f}', { f: biggest.map(p => `#${p.position.fifo}`).join(' · ') })} />
      <Stat label={t('Same work, different order')}
        value={`${fmt(totalHours, 0)} ${t('h')}`}
        note={t('{n} applications, {c} tCO₂e/day in total under both policies; only the order changes', { n: rows.length, c: fmt(totalCarbon) })} />
    </div>
    <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-sm">
      <h2 className="font-title-sm text-title-sm font-semibold">{t('Who is reviewed first')}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t('Left: submission order (FIFO). Right: CarbonQueue. Green lines are projects moved forward; numbers are daily tCO₂e.')}</p>
      {rows.length <= MAX_SLOPE_ROWS
        ? <Slope fifo={fifoOrder} cq={cqOrder} />
        : <p className="font-body-sm text-body-sm text-on-surface-variant">{t('The side-by-side order is shown for up to {n} applications; the chart below covers the whole queue.', { n: MAX_SLOPE_ROWS })}</p>}
    </section>
    <section className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-sm">
      <h2 className="font-title-sm text-title-sm font-semibold">{t('Carbon reviewed as the work proceeds')}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t('Daily tCO₂e of the projects already reviewed, by reviewer hours spent. Both lines end at the same point: the difference is how early the impact is reached.')}</p>
      <div className="results-legend"><span><i style={{ background: FIFO_COLOR }} />FIFO</span><span><i style={{ background: CQ_COLOR }} />CarbonQueue</span></div>
      <Cumulative fifo={fifo} cq={cq} budget={budget} />
      <details className="chart-values"><summary>{t('View chart data')}</summary><div className="overflow-x-auto"><table>
        <thead><tr><th>{t('Project')}</th><th>FIFO #</th><th>CarbonQueue #</th><th>tCO₂e/{t('day')}</th><th>{t('Effort h')}</th></tr></thead>
        <tbody>{cqOrder.map(p => <tr key={p.applicationId || p.id}><th>{p.name}</th><td>{p.position.fifo}</td><td>{p.position.carbonqueue}</td><td>{fmt(carbonOf(p))}</td><td>{fmt(p.effort, 0)}</td></tr>)}</tbody>
      </table></div></details>
    </section>
  </div>;
}
