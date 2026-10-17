import React, { createContext, useContext } from 'react';
import { LIVE_POLICIES, fmt, reasonFor } from './live-data.js';
import { useT } from './i18n.jsx';
import { countryName } from './countries.js';
import { needsClaimCheck } from './live-data.js';
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
export function Icon({children}) { return <span aria-hidden="true" className="material-symbols-outlined">{children}</span>; }

export function QueueRows() {
  const ctx = useApp();
  const { t } = useT();
  const policyKey = LIVE_POLICIES[ctx.policy].key;
  const maxWeek = Math.max(1, ...ctx.page.map(p => p.plannedWeek[policyKey] || 1));
  return <tbody className="divide-y divide-surface-container text-body-sm">
    {ctx.live.status === 'ready' && !ctx.rows.length && <tr><td colSpan="9" className="p-10 text-center">{t('No applications for {c} yet. Upload the documents of a project to start this queue.', { c: countryName(ctx.country) })} <a href="#/upload" className="font-semibold text-secondary hover:underline">{t('Upload documents')}</a></td></tr>}
    {!ctx.page.length && (ctx.live.status !== 'ready' || ctx.rows.length > 0) && <tr><td colSpan="9" className="p-10 text-center">{t(ctx.live.status === 'ready' ? 'No matching projects. Try another search or filter.' : ctx.live.status === 'loading' ? 'Loading live queue…' : 'Live queue unavailable.')}</td></tr>}
    {ctx.page.map(p => {
      const shift = (p.position.fifo || 0) - (p.position[policyKey] || 0);
      return <tr key={p.id} className="hover:bg-surface-container-low">
        <td className="p-3 text-center"><strong className="text-headline-md">{p.position[policyKey]}</strong>{policyKey !== 'fifo' && (shift === 0 ? <div className="shift-none" title={t('Same place as in submission order (FIFO)')}>= FIFO</div> : <div className={shift > 0 ? 'text-secondary' : 'text-error'}>{shift > 0 ? '▲ +' : '▼ '}{shift}</div>)}</td>
        <td className="p-3 min-w-[200px]"><button className="text-left font-semibold text-[15px] hover:underline" onClick={() => ctx.openProject(p)}>{p.name}</button><div className="text-on-surface-variant font-mono text-xs mt-1">{ctx.country === 'GB' ? 'REPD ' : 'ID '}{p.id} · {p.authority}{needsClaimCheck(p, ctx.rows.length) && <span className="ml-2 px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-sans text-[10px] font-semibold" title={t('The impact comes from the applicant and is not verified; it puts this file in the first fifth of the queue, so check the statement before the review.')}>{t('Check stated impact')}</span>}</div>{ctx.view === 'gantt' && <div className="mt-2 h-2 rounded bg-surface-container" title={t('Planned review week {w}', { w: p.plannedWeek[policyKey] })}><div className="h-2 rounded bg-secondary" style={{width: `${(p.plannedWeek[policyKey] || 1) / maxWeek * 100}%`}} /></div>}</td>
        <td className="px-3 whitespace-nowrap"><span className="inline-flex items-center gap-1 bg-surface-container px-2 py-1 rounded"><Icon>{p.icon}</Icon>{t(p.tech)}</span></td>
        <td className="px-3 whitespace-nowrap text-right font-mono">{p.capacity ? `${fmt(p.capacity)} MW` : '—'}</td>
        <td className="px-3 whitespace-nowrap text-right">{p.carbon ? <><strong className="font-mono">{fmt(p.carbon[0], p.carbon[2] < 1 ? 2 : 1)}–{fmt(p.carbon[2], p.carbon[2] < 1 ? 2 : 1)}</strong> <small>{t('tCO₂e/day')}</small></> : <span className="text-on-surface-variant">{t('Unscored')}</span>}</td>
        <td className="px-3 text-center">{p.risk == null ? <span className="text-on-surface-variant" title={t('No validated prediction model for this country or project type')}>—</span> : <><strong>{fmt(p.risk)}%</strong><div className="h-1.5 bg-surface-container-highest rounded w-10 mx-auto mt-1"><div className="bg-secondary h-full rounded" style={{width: `${Math.min(p.risk * 5, 100)}%`}} /></div></>}</td>
        <td className="px-3 whitespace-nowrap">{fmt(p.effort, 0)} {t('h')}</td>
        <td className="px-3 whitespace-nowrap">{p.wait} {t('days')}</td>
        <td className="px-3">{reasonFor(p, policyKey).text}</td>
      </tr>;
    })}
  </tbody>;
}
