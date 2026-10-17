import { needsClaimCheck } from '../live-data.js';
import React, { useEffect, useState } from 'react';
import { useApp } from '../state.jsx';
import { api } from '../api.js';
import { LANE_LABELS, LIVE_POLICIES, fmt, reasonFor } from '../live-data.js';
import { useT } from '../i18n.jsx';

function MetricInfo({id,label,children}) {
  const [open,setOpen]=useState(false);
  return <span className="metric-info" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
    <button type="button" className="metric-info-button" aria-label={label} aria-describedby={open?'metric-help-'+id:undefined} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onClick={()=>setOpen(true)} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);e.stopPropagation();}}}>i</button>
    {open&&<span role="tooltip" id={'metric-help-'+id} className="metric-tooltip">{children}</span>}
  </span>;
}

const Row = ({ label, children }) => <div className="flex justify-between gap-4 py-1.5 border-b border-surface-container last:border-0"><span className="text-on-surface-variant">{label}</span><span className="text-on-surface text-right">{children}</span></div>;
const Flag = ({ label, ok, children }) => <div className="flex items-center justify-between p-space-sm rounded bg-surface-container-low">
  <span className="font-body-sm text-body-sm text-on-surface">{label}</span>
  <div className={'flex items-center gap-1 font-label-xs text-label-xs font-semibold '+(ok?'text-secondary':'text-error')}><span className="material-symbols-outlined text-[16px]">{ok?'check_circle':'error'}</span>{children}</div>
</div>;
const DOMAIN = { IN_DOMAIN: 'in domain', OUT_OF_DOMAIN: 'out of domain', UNKNOWN: 'unknown' };

export default function Project() {
  const ctx = useApp();
  const { t } = useT();
  const p = ctx.selected;
  const [application, setApplication] = useState({ status: 'idle' });
  useEffect(() => {
    if (!p?.applicationId) return;
    setApplication({ status: 'loading' });
    api.application(p.applicationId).then(data => setApplication({ status: 'ready', data })).catch(error => setApplication({ status: 'error', error }));
  }, [p?.applicationId]);

  if (!p) return <div className="workspace-page px-gutter-desktop py-space-xl"><section className="results-panel"><h2>{t('No application selected')}</h2><p>{t('Open an application from the queue to see its details.')}</p><a className="queue-control mt-4" href="#/queue">{t('Back to queue')}</a></section></div>;

  const policyKey = LIVE_POLICIES[ctx.policy].key, policyLabel = t(LIVE_POLICIES[ctx.policy].label);
  const pos = p.position[policyKey], fifo = p.position.fifo, gained = fifo - pos;
  const readiness = application.data?.readiness;
  const why = reasonFor(p, policyKey), cqWhy = reasonFor(p, 'carbonqueue');
  const annual = p.carbon ? [p.carbon[0] * 365 / 1000, p.carbon[2] * 365 / 1000] : null;
  const metrics = [
    {id:'carbon',label:t('Displaced emissions'),value:p.carbon?`${fmt(p.carbon[0])}–${fmt(p.carbon[2])}`:t('Unscored'),unit:p.carbon?t('tCO₂e / day · central {c}',{c:fmt(p.carbon[1])}):t('No generation-carbon estimate for this technology'),description:t('MW × 24 h × load factor (DUKES 2026) × displacement emission factor. Low: grid average, central: long-run marginal (Green Book), high: gas-fired generation. A potential, not a measured saving.')},
    {id:'withdrawal',label:t('Withdrawal within 12 months'),value:p.risk == null ? '—' : `${fmt(p.risk)}%`,unit:t(p.risk == null ? 'No validated model' : 'Model probability'),description:t('Probability that the applicant withdraws within 12 months (CatBoost model trained on REPD). Not a probability of permission or refusal.'),progress:Math.min(p.risk*5,100)},
    {id:'effort',label:t('Estimated review effort'),value:`${fmt(p.effort,0)} ${t('h')}`,description:t('Rule-based: 4 points base, +2 from 1 MW, +2 more from 20 MW, +2 with a storage component; 1 point = 2 reviewer hours.')},
    {id:'waiting',label:t('Waiting time'),value:`${p.wait} ${t('days')}`,description:t('Submitted {d}. Files waiting over 365 days enter maximum-wait protection.',{d:p.submitted}),progress:Math.min(p.wait/365*100,100)},
  ];
  return (<div className="flex flex-col w-full">
  <div className="px-gutter-desktop py-space-xl max-w-[1520px] mx-auto w-full space-y-space-xl">
    <div className="flex flex-col gap-space-md">
      <div className="flex items-center gap-space-sm font-label-md text-label-md">
        <a className="inline-flex items-center gap-1 px-space-sm py-1 rounded bg-surface-container-low text-on-surface hover:bg-surface-container text-label-md transition-colors" href="#/queue"><span className="material-symbols-outlined text-[16px]">arrow_back</span>{t('Back to queue')}</a>
        <span className="text-on-surface-variant/40">/</span><span className="font-semibold text-on-surface">{p.name}</span>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg bg-surface-container-lowest p-space-xl rounded-xl shadow-sm">
        <div className="space-y-space-sm">
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">{p.name}</h1>
          <div className="flex flex-wrap items-center gap-space-xs font-label-md text-label-md">
            {[t(p.tech), p.capacity ? `${fmt(p.capacity)} MW` : t('Capacity not stated'), p.hasStorage ? t('With storage') : null, p.authority].filter(Boolean).map(x => <span key={x} className="px-2.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium">{x}</span>)}
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-mono text-label-xs tracking-wider">{ctx.country === 'GB' ? 'REPD' : 'ID'} {p.id}</span>
          </div>
        </div>
        <div className="flex flex-col text-right px-space-xl py-space-md bg-surface-container-low rounded-xl">
          <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider">{t('{p} position', { p: policyLabel })}</span>
          <span className="font-display-lg text-display-lg font-bold text-on-surface">#{pos}</span>
          <span className="font-label-md text-label-md text-on-surface-variant">{t('of {n} · planned review week {w}', { n: ctx.rows.length, w: p.plannedWeek[policyKey] })}</span>
        </div>
      </div>
    </div>
    <div className="relative overflow-hidden bg-surface-container-lowest p-space-xl rounded-xl shadow-sm">
      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-secondary" />
      <div className="space-y-space-sm max-w-4xl pl-space-sm">
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="font-headline-md text-headline-md text-on-surface">{t('Why is this application here?')}</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary-fixed text-on-secondary-fixed-variant font-label-xs text-label-xs font-semibold uppercase tracking-wider">{policyLabel} · {t(LANE_LABELS[why.lane] || why.lane)}</span>
        </div>
        <p className="font-title-sm text-title-sm text-on-surface leading-relaxed">{why.text}</p>
        {policyKey !== 'carbonqueue' && <p className="font-body-md text-body-md text-on-surface-variant">{t('Under CarbonQueue')}: {cqWhy.text}</p>}
        <p className="font-body-md text-body-md text-on-surface-variant">{t('The order only decides which file is opened next. The planning decision remains with the reviewing officer.')}</p>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
      {metrics.map(metric=><div key={metric.id} className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm space-y-2">
        <div className="flex items-start justify-between gap-2"><span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">{metric.label}</span><MetricInfo id={metric.id} label={metric.label}>{metric.description}</MetricInfo></div>
        <div className="font-metric-num text-metric-num text-on-surface">{metric.value}</div>
        {metric.unit&&<div className="font-label-md text-label-md text-secondary font-medium">{metric.unit}</div>}
        {metric.progress!=null&&<div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden"><div className={metric.id==='waiting'?'bg-tertiary-fixed-dim h-full rounded-full':'bg-secondary h-full rounded-full'} style={{width:metric.progress+'%'}} /></div>}
      </div>)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
      <div className="lg:col-span-6 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm space-y-space-lg">
        <h2 className="font-headline-md text-headline-md text-on-surface">{t('Position by policy')}</h2>
        <div className="bg-surface-container-low p-space-md rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-space-md">
            <div className="flex flex-col"><span className="font-label-xs text-label-xs text-on-surface-variant uppercase">FIFO</span><span className="font-metric-num text-metric-num text-on-surface-variant">#{fifo}</span></div>
            <span className="material-symbols-outlined text-secondary text-[24px]">trending_flat</span>
            <div className="flex flex-col"><span className="font-label-xs text-label-xs text-secondary uppercase font-semibold">{policyLabel}</span><span className="font-metric-num text-metric-num text-secondary">#{pos}</span></div>
          </div>
          {policyKey !== 'fifo' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary-container/40 text-on-secondary-container font-label-xs text-label-xs font-semibold">{t('{n} positions', { n: gained >= 0 ? `+${gained}` : gained })}</span>}
        </div>
        <div className="space-y-space-sm font-body-md text-body-md">
          {LIVE_POLICIES.map(pol => <Row key={pol.key} label={t(pol.label)}>#{p.position[pol.key]} · {t('week {w}', { w: p.plannedWeek[pol.key] })}</Row>)}
          <Row label={t('Submitted')}>{p.submitted} ({t('{n} days ago', { n: p.wait })})</Row>
        </div>
      </div>
      <div className="lg:col-span-6 space-y-space-xl">
        <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm space-y-space-md">
          <div className="flex items-center justify-between"><h2 className="font-headline-md text-headline-md text-on-surface">{t('Carbon impact details')}</h2><span className="px-2.5 py-0.5 rounded bg-secondary-container/30 text-on-secondary-container font-label-xs text-label-xs font-semibold">{t('Modeled range')}</span></div>
          {p.carbon ? <div className="space-y-space-sm font-body-md text-body-md">
            <Row label={t('Daily displacement (low – central – high)')}>{fmt(p.carbon[0])} – {fmt(p.carbon[1])} – {fmt(p.carbon[2])} tCO₂e</Row>
            <Row label={t('Annualised (low – high)')}>{fmt(annual[0])} – {fmt(annual[1])} {t('ktCO₂e / year')}</Row>
            <Row label={t('Emission factor year')}>{t('{y} + 2 years (time to operation)', { y: ctx.live.data?.as_of?.slice(0,4) })}</Row>
          </div> : <p className="font-body-md text-body-md text-on-surface-variant">{t('No generation-carbon estimate for this technology or capacity. The application moves through the unscored lane in submission order, with its share of reviewer capacity.')}</p>}
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t('Estimates describe displacement potential, not guaranteed savings.')} <a className="font-semibold text-on-surface hover:underline" href="#/methodology">{t('Sources')} →</a></p>
        </div>
        <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm space-y-space-md">
          <div className="flex items-center justify-between"><h2 className="font-headline-md text-headline-md text-on-surface">{t('Record & data quality')}</h2><span className="font-label-xs text-label-xs text-on-surface-variant">{t('Backend application record')}</span></div>
          {application.status === 'loading' && <p className="text-body-sm text-on-surface-variant">{t('Loading application record…')}</p>}
          {application.status === 'error' && <p className="text-body-sm text-error">{t(application.error.message)}</p>}
          {readiness && <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
            <Flag label={t('Missing fields')} ok={!readiness.missing_fields.length}>{readiness.missing_fields.length ? readiness.missing_fields.join(', ') : t('None')}</Flag>
            <Flag label={t('Conflicts')} ok={!readiness.conflicts.length}>{readiness.conflicts.length || t('None')}</Flag>
            <Flag label={t('Model domain')} ok={readiness.domain_status !== 'OUT_OF_DOMAIN'}>{t(DOMAIN[readiness.domain_status] || readiness.domain_status)}</Flag>
            <Flag label={t('Ready for review')} ok={readiness.ready_for_review}>{t(readiness.ready_for_review ? 'Yes' : 'Needs review')}</Flag>
          </div>}
          {application.data?.source && <p className="font-body-sm text-body-sm text-on-surface-variant">{t('Source: {s} record {id}. Imported records carry no document evidence; uploaded PDFs show quotes and pages in Upload.', { s: application.data.source.name, id: application.data.source.external_id })}</p>}
        </div>
      </div>
    </div>
  </div>
</div>); }
