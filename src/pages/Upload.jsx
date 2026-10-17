import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../state.jsx';
import { api } from '../api.js';
import { LANE_LABELS, fmt, laneReason } from '../live-data.js';
import { useT } from '../i18n.jsx';
import { LIVE_COUNTRY, countryName } from '../countries.js';

const FIELD_LABELS = { technology: 'Technology', capacity_mw: 'Capacity (MW)', project_name: 'Project name', planning_authority: 'Planning authority',
  site_location: 'Site location', applicant: 'Applicant', submission_date: 'Submission date', has_storage: 'Storage component',
  annual_co2e_reduction_t: 'Stated reduction (tCO₂e/year)', annual_energy_mwh: 'Stated energy (MWh/year)', country: 'Country' };
// Fields whose scope decides whether the value belongs to this application.
const SCOPED = ['capacity_mw', 'annual_co2e_reduction_t', 'annual_energy_mwh'];
const NUMERIC = SCOPED;
const TECHNOLOGIES = { solar: 'Solar PV', onshore_wind: 'Onshore wind', battery: 'Battery storage', hydro: 'Hydro', biomass: 'Biomass', tidal: 'Tidal', wave: 'Wave',
  // Outside the historical model: queued on the stated annual impact
  heat_pump: 'Heat pump', energy_efficiency: 'Energy efficiency', electrification: 'Electrification', ev_charging: 'EV charging',
  building_retrofit: 'Building retrofit', low_carbon_transport: 'Low-carbon transport', carbon_capture: 'Carbon capture', digital_service: 'Digital service' };
const CATEGORY = { solar: 'solar', onshore_wind: 'onshore_wind', battery: 'storage', biomass: 'bioenergy_waste', hydro: 'other_renewable', tidal: 'other_renewable', wave: 'other_renewable' };
const STATUS = { NEEDS_REVIEW: 'Needs human review', READY: 'Ready for review', SCORED: 'Scored', FAILED: 'Failed' };
const SCOPE = { existing_project: 'existing project', neighbouring_project: 'neighbouring project', grid_connection: 'grid connection', unknown: 'unknown scope' };

// Where a scored application would sit in the live snapshot: carbon-lane files are ordered by
// (1 − withdrawal) × daily tCO₂e ÷ effort, the same score the queue engine uses.
function livePlacement(live, app) {
  const central = app.carbon?.daily_tco2?.central, hours = app.effort?.reviewer_hours;
  if (!live || central == null || !hours) return null;
  const score = (1 - (app.prediction?.withdrawal_probability_12m || 0)) * central / hours;
  const ranked = live.files.filter(f => f.lane === 'carbon' && f.daily_tco2 && f.effort_hours)
    .map(f => ({ f, s: (1 - (f.p_withdraw_12m || 0)) * f.daily_tco2.central / f.effort_hours }))
    .sort((a, b) => b.s - a.s);
  const index = ranked.findIndex(x => x.s < score), slot = index < 0 ? ranked.length : index;
  const above = ranked[slot - 1]?.f, below = ranked[slot]?.f;
  return { lanePosition: slot + 1, laneTotal: ranked.length + 1, above, below,
    position: below ? below.position.carbonqueue : above ? above.position.carbonqueue + 1 : 1,
    total: live.files.length + 1, week: (below || above)?.planned_week?.carbonqueue || 1 };
}

// Outside Great Britain the queue is the uploaded applications themselves: the engine has
// already ranked this one, so its place is read from the country queue instead of estimated.
function queuePlacement(queue, own) {
  const byPosition = [...queue.files].sort((a, b) => a.position.carbonqueue - b.position.carbonqueue);
  const index = byPosition.findIndex(f => f.application_id === own.application_id);
  return { exact: true, position: own.position.carbonqueue, total: queue.files.length, lane: own.lane,
    above: byPosition[index - 1], below: byPosition[index + 1], week: own.planned_week?.carbonqueue || 1 };
}

function Card({ title, value, note, tone }) {
  return <div className="bg-surface-container-low p-space-md rounded-lg flex flex-col">
    <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider">{title}</span>
    <span className={'font-metric-num text-metric-num mt-1 '+(tone==='bad'?'text-error':'text-on-surface')}>{value}</span>
    {note && <span className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">{note}</span>}
  </div>;
}

export default function Upload() {
  const ctx = useApp();
  const { t } = useT();
  const input = useRef(null);
  const [files, setFiles] = useState([]), [phase, setPhase] = useState('idle'), [error, setError] = useState(null);
  const [app, setApp] = useState(null), [entry, setEntry] = useState(null), [edits, setEdits] = useState({});
  const addFiles = list => { const pdfs = Array.from(list).filter(f => /\.pdf$/i.test(f.name) && f.size <= 20 * 1024 * 1024); setFiles(prev => [...prev, ...pdfs].slice(0, 10)); if (pdfs.length < list.length) ctx.setNotice(t('Only PDF files up to 20 MB are accepted.')); };
  const fail = e => { setError(e); setPhase('error'); };

  async function extract() {
    setPhase('extracting'); setError(null); setApp(null); setEntry(null);
    try { setApp(await api.extract(files, ctx.country)); setPhase('done'); } catch (e) { fail(e); }
  }
  async function correct(e) {
    e.preventDefault();
    const values = Object.fromEntries(Object.entries(edits).filter(([, v]) => v !== '').map(([k, v]) => [k, NUMERIC.includes(k) ? Number(v) : v]));
    if (!Object.keys(values).length) return;
    try { setApp(await api.correct(app.application_id, app.revision, values, 'Confirmed by reviewer from source documents')); setEdits({}); ctx.setNotice(t('Correction recorded with audit trail.')); } catch (err) { fail(err); }
  }
  async function score() {
    setPhase('scoring');
    try {
      const capacity = ctx.live.data?.calibration?.capacity_hours_per_week || 300;
      const result = await api.runQueue([app.application_id], capacity);
      setEntry(result.entries[0]); setApp(await api.application(app.application_id)); setPhase('done');
    } catch (e) { fail(e); }
  }

  const readiness = app?.readiness, features = app?.project_features;
  const uploaded = ctx.country !== LIVE_COUNTRY;
  // A scored upload joins its country's queue: reload it to read the engine's place.
  useEffect(() => { if (uploaded && app?.carbon) ctx.loadLive(); }, [app?.application_id, Boolean(app?.carbon)]);
  const own = uploaded && app && ctx.live.status === 'ready' ? ctx.live.data.files.find(f => f.application_id === app.application_id) : null;
  const otherCountry = uploaded && app?.carbon && features?.country && features.country !== ctx.country ? features.country : null;
  const placement = app?.carbon && (uploaded ? own && queuePlacement(ctx.live.data, own) : livePlacement(ctx.live.status === 'ready' ? ctx.live.data : null, app));
  const docName = Object.fromEntries((app?.documents || []).map(d => [d.document_id, d.filename]));
  // The impact comes from the applicant's own figure only when a claim was used, not when a capacity was.
  const claimBased = readiness?.domain_status === 'CLAIM_BASED' && /beyani/i.test(app?.carbon?.methodology_reference || '');
  const required = ['technology', 'capacity_mw', 'annual_co2e_reduction_t'].filter(f => readiness?.missing_fields.includes(f) || readiness?.low_confidence_fields.includes(f) || readiness?.conflicts.some(c => c.field === f));
  const entryReason = entry && features && laneReason({
    lane: entry.lane, capacity: features.capacity_mw, carbon: app.carbon?.daily_tco2?.central, effort: app.effort?.reviewer_hours,
    category: app.carbon?.daily_tco2 ? CATEGORY[features.technology] : CATEGORY[features.technology] === 'solar' || CATEGORY[features.technology] === 'onshore_wind' ? 'capacity not stated' : CATEGORY[features.technology],
    wait: features.submission_date ? Math.max(0, Math.round((Date.now() - new Date(features.submission_date)) / 86400000)) : 0,
  });
  return (<div className="flex flex-col w-full">
  <div className="px-gutter-desktop py-space-xl max-w-[1600px] mx-auto w-full flex flex-col gap-space-xl">
    <div className="flex flex-col gap-space-xs">
      <div className="flex items-center gap-space-sm">
        <span className="font-headline-lg text-headline-lg text-on-surface">{t('Application intake')}</span>
        <span className="bg-secondary-container text-on-secondary-container font-label-xs text-label-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">{t('AI document extraction')}</span>
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">{t('The agent reads planning PDFs and extracts each value with its document, page and quote. Values that are missing, conflicting or unsupported by a quote are sent to a human; nothing is invented.')}</p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
      <div className="lg:col-span-4 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md"
        onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
        <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider font-semibold">{t('Documents')}</span>
        <div className="bg-surface-container-low rounded-lg p-space-md flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-[24px] text-primary">upload_file</span>
          <p className="font-label-md text-label-md text-on-surface font-semibold">{t('Drop application PDFs here')}</p>
          <p className="font-label-xs text-label-xs text-on-surface-variant mt-0.5">{t('Up to 10 PDFs, 20 MB each')}</p>
          <button className="mt-2.5 px-3 py-1 bg-surface-container-lowest text-on-surface font-label-md text-label-md font-medium rounded shadow-sm" onClick={() => input.current.click()}>{t('Browse files')}</button>
          <input ref={input} type="file" accept=".pdf" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>
        {files.map((f, i) => <div key={i} className="flex items-center justify-between text-body-sm bg-surface-container-low px-2.5 py-1.5 rounded">
          <span className="truncate font-medium text-on-surface">{f.name} <span className="text-on-surface-variant text-[11px]">{(f.size / 1024).toFixed(0)} KB</span></span>
          <button className="text-on-surface-variant" aria-label={t('Remove {f}', { f: f.name })} onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}>×</button>
        </div>)}
        <button className="px-space-lg py-2 bg-primary text-on-primary font-label-md text-label-md font-semibold rounded shadow-md disabled:opacity-40" disabled={!files.length || phase === 'extracting'} onClick={extract}>
          {t(phase === 'extracting' ? 'Extracting… (first run downloads OCR models)' : 'Run extraction')}
        </button>
      </div>
      <div className="lg:col-span-8 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
        {!app && phase !== 'error' && <p className="font-body-md text-body-md text-on-surface-variant">{t('Select the documents of one application and run extraction. Results appear here with their source citations.')}</p>}
        {phase === 'error' && <div role="alert" className="p-space-md rounded-lg bg-surface-container-low"><strong className="text-error">{error.code || t('Error')}</strong><p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{t(error.message)}{error.code === 'EXTRACTOR_UNAVAILABLE' ? ` (${t('GOOGLE_API_KEY in the backend .env')}).` : ''}</p></div>}
        {app && <>
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <span className="font-title-sm text-title-sm text-on-surface">{features?.project_name || t('Extracted application')}</span>
            <span className="bg-secondary-container text-on-secondary-container font-label-xs text-label-xs px-2 py-0.5 rounded-full font-semibold">{t(STATUS[app.status] || app.status)}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
            <Card title={t('Documents')} value={app.documents.length} />
            <Card title={t('Observations')} value={app.observations.length} note={t('each with a quote')} />
            <Card title={t('Conflicts')} value={readiness.conflicts.length} tone={readiness.conflicts.length ? 'bad' : ''} />
            <Card title={t('Missing')} value={readiness.missing_fields.length} note={readiness.missing_fields.map(f => t(FIELD_LABELS[f] || f)).join(', ') || t('none')} tone={readiness.missing_fields.length ? 'bad' : ''} />
          </div>
          {readiness.message && <p className="font-body-sm text-body-sm text-on-surface-variant">{t(readiness.message)}</p>}
          <div className="overflow-x-auto"><table className="w-full text-left text-body-sm">
            <thead><tr className="text-on-surface-variant uppercase font-label-xs text-label-xs"><th className="py-2 pr-3">{t('Field')}</th><th className="pr-3">{t('Value')}</th><th className="pr-3">{t('Confidence')}</th><th>{t('Evidence')}</th></tr></thead>
            <tbody className="divide-y divide-surface-container">{app.observations.map((o, i) => <tr key={i}>
              <td className="py-2 pr-3 font-medium">{t(FIELD_LABELS[o.field] || o.field)}{SCOPED.includes(o.field) && o.capacity_scope && o.capacity_scope !== 'proposed_project' && <div className="text-error text-[11px]">{t(SCOPE[o.capacity_scope] || o.capacity_scope)}: {t('not used')}</div>}</td>
              <td className="pr-3 font-mono">{o.field === 'technology' && TECHNOLOGIES[o.value] ? t(TECHNOLOGIES[o.value]) : String(o.value)}{o.unit ? ` ${o.unit}` : ''}</td>
              <td className="pr-3">{fmt(o.confidence * 100, 0)}%</td>
              <td className="text-on-surface-variant">{o.evidence.map((ev, j) => <div key={j}><span className="font-mono text-on-surface">{docName[ev.document_id] || t('document')}{ev.page ? ` · ${t('p.')}${ev.page}` : ''}</span>{ev.quote && <div className="italic pl-2 border-l-2 border-outline-variant/40">“{ev.quote}”</div>}</div>)}</td>
            </tr>)}</tbody>
          </table></div>
          {required.length > 0 && <form onSubmit={correct} className="p-space-md rounded-lg bg-surface-container-low flex flex-wrap items-end gap-space-md">
            <div className="w-full font-label-md text-label-md font-semibold text-on-surface">{t('Human confirmation needed')}</div>
            {required.includes('technology') && <label className="flex flex-col text-body-sm">{t('Technology')}<select value={edits.technology || ''} onChange={e => setEdits(v => ({ ...v, technology: e.target.value }))} className="bg-surface-container-lowest rounded px-2 py-1"><option value="">{t('Select…')}</option>{Object.entries(TECHNOLOGIES).map(([k, label]) => <option key={k} value={k}>{t(label)}</option>)}</select></label>}
            {required.includes('annual_co2e_reduction_t') && <label className="flex flex-col text-body-sm">{t('Stated annual reduction of this project (tCO₂e/year)')}<input type="number" min="0.01" step="0.01" value={edits.annual_co2e_reduction_t || ''} onChange={e => setEdits(v => ({ ...v, annual_co2e_reduction_t: e.target.value }))} className="bg-surface-container-lowest rounded px-2 py-1" /></label>}
            {required.includes('capacity_mw') && <label className="flex flex-col text-body-sm">{t('Capacity of the proposed project (MW)')}<input type="number" min="0.01" step="0.01" value={edits.capacity_mw || ''} onChange={e => setEdits(v => ({ ...v, capacity_mw: e.target.value }))} className="bg-surface-container-lowest rounded px-2 py-1" /></label>}
            <button className="px-space-md py-1.5 bg-primary text-on-primary rounded font-label-md text-label-md">{t('Record correction')}</button>
          </form>}
          {app.corrections?.length > 0 && <div className="p-space-md rounded-lg border border-outline-variant/40 flex flex-col gap-1">
            <span className="font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant font-semibold">{t('Audit trail')}</span>
            {app.corrections.map((c, i) => <div key={i} className="font-body-sm text-body-sm text-on-surface">
              <strong>{t(FIELD_LABELS[c.field] || c.field)}</strong>: {t('documents said {v}', { v: c.original_values.map(String).join(' / ') || '—' })} → <strong>{String(c.corrected_value)}</strong>
              <span className="text-on-surface-variant"> · {c.actor} · {new Date(c.changed_at).toLocaleString()}{c.reason ? ` · ${t(c.reason)}` : ''}</span>
            </div>)}
          </div>}
          {(app.status === 'READY' || app.status === 'SCORED') && <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-sm">
            {!app.carbon && <button className="self-start px-space-lg py-2 bg-primary text-on-primary font-label-md text-label-md font-semibold rounded shadow-md disabled:opacity-40" disabled={phase === 'scoring'} onClick={score}>{t(phase === 'scoring' ? 'Scoring…' : 'Score with model and queue engine')}</button>}
            {app.carbon && <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
              <Card title={t(claimBased ? 'Stated impact' : 'Displaced emissions')} value={!app.carbon.daily_tco2 ? t('Unscored') : app.carbon.daily_tco2.low === app.carbon.daily_tco2.high ? fmt(app.carbon.daily_tco2.central) : `${fmt(app.carbon.daily_tco2.low)}–${fmt(app.carbon.daily_tco2.high)}`} note={!app.carbon.daily_tco2 ? t('No generation-carbon estimate for this technology') : claimBased ? t('tCO₂e / day · applicant claim, not verified') : t('tCO₂e / day')} />
              <Card title={t('Review effort')} value={`${fmt(app.effort.reviewer_hours, 0)} ${t('h')}`} />
              <Card title={t('Withdrawal, 12 mo')} value={app.prediction ? `${fmt(app.prediction.withdrawal_probability_12m * 100)}%` : '—'} note={app.prediction ? null : t('not modelled for this project type')} />
              <Card title={t('No decision in 12 mo')} value={app.prediction ? `${fmt(app.prediction.decision_distribution[12] * 100, 0)}%` : '—'} note={t(app.prediction ? 'current process, model estimate' : 'not modelled for this project type')} />
            </div>}
            {entry && <p className="font-body-sm text-body-sm text-on-surface"><strong>{t(LANE_LABELS[entry.lane] || entry.lane)}:</strong> {entryReason}</p>}
            {placement && <div className="flex flex-col gap-1 pt-space-sm border-t border-outline-variant/30">
              <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider font-semibold">{placement.exact ? t('Place in the {c} queue', { c: countryName(ctx.country) }) : t('Place in the live queue')}</span>
              <span className="font-title-sm text-title-sm text-on-surface">{placement.exact
                ? t('#{p} of {n} · {lane} · planned review week {w}', { p: placement.position, n: placement.total, lane: t(LANE_LABELS[placement.lane] || placement.lane), w: placement.week })
                : t('≈ #{p} of {n} · carbon lane {l} of {m} · planned review week {w}', { p: placement.position, n: placement.total, l: placement.lanePosition, m: placement.laneTotal, w: placement.week })}</span>
              {placement.exact
                ? <span className="font-body-sm text-body-sm text-on-surface-variant">{placement.above ? t('After {a}', { a: placement.above.site_name }) : t('First in the queue')}{placement.below ? ' · ' + t('before {b}', { b: placement.below.site_name }) : ''}</span>
                : <span className="font-body-sm text-body-sm text-on-surface-variant">{placement.above ? t('After {a}', { a: placement.above.site_name }) : t('First in the carbon lane')}{placement.below ? ' · ' + t('before {b}', { b: placement.below.site_name }) : ''}</span>}
              <span className="font-label-xs text-label-xs text-on-surface-variant">{placement.exact
                ? t('Ranked by the queue engine together with the other applications uploaded for {c}.', { c: countryName(ctx.country) })
                : t('Same score as the queue engine, compared with the live snapshot of {d}; the next queue run confirms the exact place.', { d: ctx.live.data.as_of })}</span>
            </div>}
            {otherCountry && <p className="font-body-sm text-body-sm text-on-surface-variant pt-space-sm border-t border-outline-variant/30">{t('The documents place this project in {c}, so it is ranked in the {c} queue, not in this workspace.', { c: countryName(otherCountry) })}</p>}
          </div>}
        </>}
      </div>
    </div>
  </div>
</div>); }
