import React, { useState } from 'react';
import { useApp, QueueRows } from '../state.jsx';
import { queueSortLabels } from '../queue-sort.js';
import { useHistorical } from '../api.js';
import { LIVE_POLICIES, TECH, fmt } from '../live-data.js';
import { useT } from '../i18n.jsx';
import Compare from './Compare.jsx';
import { LIVE_COUNTRY, countryName } from '../countries.js';

const REFERENCE_YEAR = 2023;

function SortHeading({ sortKey, children }) {
  const ctx = useApp();
  const { t } = useT();
  const active = ctx.sort?.key === sortKey;
  return <th scope="col" className="queue-column-heading" aria-sort={active ? (ctx.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button type="button" className="sort-heading" onClick={() => ctx.toggleSort(sortKey)}>{children || t(queueSortLabels[sortKey])}<span aria-hidden="true">{active ? (ctx.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button>
  </th>;
}

function Kpi({ label, icon, value, unit, children }) {
  return <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm flex flex-col justify-between">
    <div className="flex items-center justify-between">
      <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-medium">{label}</span>
      <span className="material-symbols-outlined text-outline text-[18px]">{icon}</span>
    </div>
    <div className="my-space-xs flex items-baseline gap-2">
      <span className="font-metric-num text-metric-num text-on-surface">{value}</span>
      {unit && <span className="font-label-md text-label-md text-on-surface-variant">{unit}</span>}
    </div>
    <div className="font-label-xs text-label-xs text-on-surface-variant">{children}</div>
  </div>;
}

export default function Queue() {
  const ctx = useApp();
  const { t } = useT();
  const [policyOpen, setPolicyOpen] = useState(false), [whyOpen, setWhyOpen] = useState(false);
  const history = useHistorical(REFERENCE_YEAR);
  const live = ctx.live.status === 'ready' ? ctx.live.data : null;
  const cq = history.data?.carbonqueue, fifo = history.data?.fifo;
  const gain = cq?.carbon_gain_tco2_vs_fifo;
  const capacity = live?.calibration?.capacity_hours_per_week;
  const lanes = live?.lane_counts || {};
  const uploaded = ctx.country !== LIVE_COUNTRY;
  return (<div className="flex flex-col w-full text-on-surface antialiased pb-space-xl">
  <div className="px-gutter-desktop pt-space-lg pb-space-md flex flex-col gap-space-md border-b border-outline-variant/30 bg-surface-container-lowest">
    <div className="flex flex-wrap items-center justify-between gap-y-space-md">
      <div>
        <div className="flex items-center gap-space-sm mb-0.5">
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{t('Review Queue')}</h1>
          <span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-xs text-label-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            {live ? t('{n} applications waiting', { n: ctx.rows.length }) : t('Connecting…')}
          </span>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {uploaded ? t('Review order for the applications uploaded for {c}', { c: countryName(ctx.country) }) : t('Review order for pending English renewable applications')}{live ? t(uploaded ? ', as of {d}' : ', snapshot {d}', { d: live.as_of }) : ''}. {t('Decision support only: CarbonQueue does not approve or refuse applications.')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-space-lg">
        <div className="bg-surface-container-low px-space-md py-space-sm rounded-lg flex flex-col min-w-[210px] gap-1 shadow-xs">
          <div className="flex justify-between items-center font-label-xs text-label-xs">
            <span className="text-on-surface-variant font-medium">{t('Weekly reviewer capacity')}</span>
            <span className="font-semibold text-on-surface">{capacity ? `${fmt(capacity, 0)} ${t('h')}` : '—'}</span>
          </div>
          <span className="font-label-xs text-[10px] leading-3 text-on-surface-variant/80">{t(uploaded ? 'England 2023 calibration, until local data' : 'Calibrated to observed decision times')}</span>
        </div>
        <div className="flex items-center gap-space-sm">
          <button className="inline-flex items-center gap-space-xs px-space-md py-space-sm rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors shadow-xs" type="button" onClick={ctx.exportCsv} disabled={!live}>
            <span className="material-symbols-outlined text-[18px]">file_download</span>
            {t('Export queue (CSV)')}
          </button>
          <button className="inline-flex items-center gap-space-xs px-space-md py-space-sm rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors shadow-xs" type="button" onClick={() => ctx.navigate('results')}>
            <span className="material-symbols-outlined text-[18px]">bar_chart</span>
            {t('View results')}
          </button>
        </div>
      </div>
    </div>
  </div>
  <div className="px-gutter-desktop flex flex-col gap-space-lg pt-space-lg">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
      <Kpi label={t('Applications in queue')} icon="fact_check" value={live ? ctx.rows.length : '—'}>
        {live ? t('{c} carbon · {m} max-wait · {s} small-project · {u} unscored · {n} awaiting confirmation', { c: lanes.carbon || 0, m: lanes.max_wait || 0, s: lanes.small_quota || 0, u: lanes.unscored || 0, n: live.needs_confirmation.length }) : '—'}
      </Kpi>
      <Kpi label={t(uploaded ? 'Median wait · England {y}' : 'Median wait · {y} queue', { y: REFERENCE_YEAR })} icon="hourglass_empty" value={cq ? fmt(cq.wait_days.all.median, 0) : '—'} unit={t('days')}>
        {fifo ? t('FIFO {d} days · simulated, same capacity', { d: fmt(fifo.wait_days.all.median, 0) }) : t('Historical simulation')}
      </Kpi>
      <Kpi label={t(uploaded ? 'P90 wait · England {y}' : 'P90 wait · {y} queue', { y: REFERENCE_YEAR })} icon="speed" value={cq ? fmt(cq.wait_days.all.p90, 0) : '—'} unit={t('days')}>
        {fifo ? t('FIFO {d} days · small projects {a} → {b}', { d: fmt(fifo.wait_days.all.p90, 0), a: fmt(fifo.wait_days.small_scored.p90, 0), b: fmt(cq.wait_days.small_scored.p90, 0) }) : t('Historical simulation')}
      </Kpi>
      <Kpi label={t(uploaded ? 'Carbon gain vs FIFO · England {y}' : 'Carbon gain vs FIFO · {y}', { y: REFERENCE_YEAR })} icon="eco" value={gain ? fmt(gain['alpha_0.5'].central / 1000, 1) : '—'} unit="ktCO₂e">
        {gain ? t('Full range {a}–{b} kt · central emission factor, 50% pass-through', { a: fmt(gain['alpha_0.2'].low / 1000, 1), b: fmt(gain['alpha_1.0'].high / 1000, 0) }) : t(history.status === 'error' ? 'Historical results unavailable' : 'Loading…')}
      </Kpi>
    </div>
    <div className="queue-toolbar">
      <div className="queue-toolbar-fields">
        <div className="queue-toolbar-search relative">
          <span className="material-symbols-outlined absolute left-3 top-2 text-outline text-[18px]">search</span>
          <input aria-label={t('Search projects')} value={ctx.search} onChange={e => ctx.setSearch(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low focus:bg-surface-container-lowest rounded text-on-surface placeholder:text-outline font-body-sm text-body-sm outline-none transition-all focus:ring-1 focus:ring-on-surface/40" placeholder={t('Search by project, REPD ID or authority...')} type="text" />
        </div>
        <div className="queue-filter-pair"><div className="relative inline-block">
          <select value={ctx.filters[0]} aria-label={t('Technology')} onChange={e => ctx.setFilter(0, e.target.value)} className="appearance-none bg-surface-container-low text-on-surface px-space-md py-1.5 pr-8 rounded font-label-md text-label-md outline-none cursor-pointer hover:bg-surface-container transition-colors">
            <option value="">{t('All technologies')}</option>
            {Object.entries(TECH).map(([key, tech]) => <option key={key} value={key}>{t(tech.label)}</option>)}
          </select>
          <span className="material-symbols-outlined absolute right-2 top-2 pointer-events-none text-outline text-[16px]">expand_more</span>
        </div>
        <button className="queue-control" aria-label={t('Sort technologies alphabetically')} aria-pressed={ctx.sort?.key==='tech'} onClick={()=>ctx.toggleSort('tech')}>A–Z <span className="material-symbols-outlined">{ctx.sort?.key==='tech'&&ctx.sort.direction==='desc'?'arrow_downward':'arrow_upward'}</span></button></div>
        <div className="queue-filter-pair"><div className="relative inline-block">
          <select value={ctx.filters[1]} aria-label={t('Capacity')} onChange={e => ctx.setFilter(1, Number(e.target.value))} className="appearance-none bg-surface-container-low text-on-surface px-space-md py-1.5 pr-8 rounded font-label-md text-label-md outline-none cursor-pointer hover:bg-surface-container transition-colors">
            <option value={0}>{t('Capacity: all sizes')}</option>
            <option value={1}>&lt; 5 MW</option>
            <option value={2}>5 – 25 MW</option>
            <option value={3}>&gt; 25 MW</option>
          </select>
          <span className="material-symbols-outlined absolute right-2 top-2 pointer-events-none text-outline text-[16px]">expand_more</span>
        </div>
        <button className="queue-control" aria-label={t('Sort by capacity')} aria-pressed={ctx.sort?.key==='capacity'} onClick={()=>ctx.toggleSort('capacity')}>{t('Capacity')} <span className="material-symbols-outlined">{ctx.sort?.key==='capacity'&&ctx.sort.direction==='asc'?'arrow_upward':'arrow_downward'}</span></button></div>
        <div className="relative inline-block">
          <select value={ctx.filters[2]} aria-label={t('Waiting time')} onChange={e => ctx.setFilter(2, Number(e.target.value))} className="appearance-none bg-surface-container-low text-on-surface px-space-md py-1.5 pr-8 rounded font-label-md text-label-md outline-none cursor-pointer hover:bg-surface-container transition-colors">
            <option value={0}>{t('Wait: all durations')}</option>
            <option value={1}>&gt; 90 {t('days')}</option>
            <option value={2}>&gt; 365 {t('days')} ({t('maximum-wait protection')})</option>
          </select>
          <span className="material-symbols-outlined absolute right-2 top-2 pointer-events-none text-outline text-[16px]">expand_more</span>
        </div>
      </div>
      <div className="queue-toolbar-actions"><button className="queue-control" aria-expanded={policyOpen} aria-controls="policy-options" onClick={()=>setPolicyOpen(!policyOpen)}><span className="material-symbols-outlined">tune</span>{t('Review policy')}: {t(LIVE_POLICIES[ctx.policy].label)}<span className="material-symbols-outlined">{policyOpen?'expand_less':'expand_more'}</span></button>
      <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded">
        {[['table','table_rows','Table view'],['gantt','timeline','Planned weeks'],['compare','compare_arrows','Compare with FIFO']].map(([key, icon, label]) => <button key={key} type="button" aria-pressed={ctx.view===key} onClick={() => ctx.setView(key)} className={"px-space-sm py-1 rounded font-label-xs text-label-xs flex items-center gap-1 "+(ctx.view===key?'bg-white shadow-xs text-on-surface font-semibold':'text-on-surface-variant hover:text-on-surface font-medium')}>
          <span className="material-symbols-outlined text-[16px]">{icon}</span>{t(label)}
        </button>)}
      </div>
      </div>
    </div>
    {policyOpen && (<div id="policy-options" className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-md">
      <div className="flex flex-col"><div className="font-title-sm text-[17px] font-semibold text-on-surface">{t('Review policy')}</div><p className="font-body-md text-body-md text-on-surface-variant">{t('Each order comes from the same simulator, with the same reviewer capacity and effort rules. Arrows in the queue show the change against FIFO.')}</p></div>
      <div className="bg-surface-container-low p-1 rounded-lg flex flex-wrap gap-1">{LIVE_POLICIES.map((p, i) => <button key={p.key} onClick={() => { ctx.setSort(null); ctx.setPolicy(i); }} className={"flex-1 min-w-[120px] px-space-md py-space-sm rounded text-label-md " + (ctx.policy === i ? "bg-white shadow-sm font-semibold" : "text-on-surface-variant")} type="button">{i + 1}. {t(p.label)}{p.key === 'carbonqueue' && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-xs text-[10px] uppercase font-bold tracking-wider">{t('Recommended')}</span>}</button>)}</div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t('The withdrawal and effort steps of the ablation are compared in Results → Historical analysis.')}</p>
    </div>)}
    <div className="queue-explanation-bar"><span>{ctx.sort ? t(queueSortLabels[ctx.sort.key])+' · '+t(ctx.sort.direction==='desc'?'Descending':'Ascending') : t('Ordered by {p}', { p: t(LIVE_POLICIES[ctx.policy].label) })}</span><div>{ctx.sort&&<button className="queue-control" onClick={()=>ctx.setSort(null)}>{t('Reset order')}</button>}<button className="queue-control" aria-expanded={whyOpen} aria-controls="queue-explanation" onClick={()=>setWhyOpen(!whyOpen)}><span className="material-symbols-outlined">psychology_alt</span>{t('Why this queue?')}<span className="material-symbols-outlined">{whyOpen?'chevron_right':'chevron_left'}</span></button></div></div>
    {ctx.view === 'compare' ? <Compare /> : <div className={'queue-layout '+(whyOpen?'with-explanation':'')}>
      <div className="min-w-0 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="queue-table w-full text-left border-collapse">
            <colgroup>{[5,21,12,8,13,8,6,7,20].map((width,index)=><col key={index} style={{width:width+'%'}} />)}</colgroup>
            <thead>
              <tr className="bg-surface-container-low font-label-xs text-label-xs uppercase text-on-surface-variant tracking-wider">
                <th scope="col" className="py-space-sm px-space-md font-semibold text-center w-14">#</th>
                <SortHeading sortKey="name" />
                <SortHeading sortKey="tech" />
                <SortHeading sortKey="capacity" />
                <SortHeading sortKey="carbon" />
                <SortHeading sortKey="risk" />
                <SortHeading sortKey="effort" />
                <SortHeading sortKey="wait" />
                <SortHeading sortKey="reason" />
              </tr>
            </thead>
            <QueueRows />
          </table>
        </div>
        <div className="px-space-md py-space-sm bg-surface-container-low flex flex-wrap items-center justify-between gap-space-md">
          <div className="font-label-xs text-label-xs text-on-surface-variant">
            {t('Showing {a} of {b} applications', { a: ctx.page.length, b: ctx.visible.length })}{ctx.visible.length !== ctx.rows.length ? t(' (filtered from {n})', { n: ctx.rows.length }) : ''}
          </div>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-xs text-label-xs shadow-xs hover:bg-surface-container transition-colors disabled:opacity-40" disabled={ctx.pageIndex === 0} onClick={() => ctx.setPageIndex(i => i - 1)}>{t('Prev')}</button>
            <span className="px-2 py-1 font-label-xs text-label-xs text-on-surface font-semibold">{ctx.pageIndex + 1} / {ctx.pageCount}</span>
            <button className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-xs text-label-xs shadow-xs hover:bg-surface-container transition-colors disabled:opacity-40" disabled={ctx.pageIndex + 1 >= ctx.pageCount} onClick={() => ctx.setPageIndex(i => i + 1)}>{t('Next')}</button>
          </div>
        </div>
      </div>
      {whyOpen && <aside id="queue-explanation" className="flex flex-col gap-space-md">
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-space-md"><div className="flex items-center gap-space-xs pb-space-xs border-b border-surface-container"><span className="material-symbols-outlined text-secondary text-[20px]">psychology_alt</span><div className="flex flex-col"><h2 className="font-title-sm text-[15px] font-semibold text-on-surface">{t('Why this queue?')}</h2><span className="font-label-xs text-[11px] text-on-surface-variant">{t("How each week's capacity is spent")}</span></div></div>
          <ol className="flex flex-col gap-2 py-1 text-body-sm text-on-surface list-decimal pl-5">
            <li><span className="font-medium">{t('Maximum-wait protection')}:</span> {t('files waiting over 365 days, oldest first, up to half of weekly capacity.')}</li>
            <li><span className="font-medium">{t('Unscored lane')}:</span> {t('storage, bioenergy and files without capacity get their effort share, in submission order.')}</li>
            <li><span className="font-medium">{t('Small-project quota')}:</span> {t('projects under 1 MW are guaranteed part of capacity.')}</li>
            <li><span className="font-medium">{t('Carbon score')}:</span> {t('(1 − withdrawal probability) × daily tCO₂e ÷ reviewer hours, highest first.')}</li>
          </ol>
          <div className="bg-surface-container-low p-space-sm rounded text-[13px] leading-relaxed text-on-surface-variant shadow-xs">{t('The order only decides which file an expert opens next. The planning decision stays with the expert.')}</div>
          <div className="pt-space-xs border-t border-surface-container"><a className="inline-flex items-center gap-1 font-label-xs text-label-xs text-on-surface font-semibold hover:text-secondary transition-colors" href="#/methodology">{t('View methodology')} →</a></div></div>
        {live?.needs_confirmation?.length > 0 && <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-tertiary-fixed-dim text-[18px]">help</span><span className="font-label-md text-label-md font-semibold text-on-surface">{t('Awaiting confirmation')} ({live.needs_confirmation.length})</span></div>
          <p className="font-body-sm text-[12px] leading-snug text-on-surface-variant">{t('Records pending for many years. They are kept out of the ranking until the authority confirms their status.')}</p>
        </div>}
      </aside>}
    </div>}
  </div>
</div>); }
