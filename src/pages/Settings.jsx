import React, {useState} from 'react';
import {useApp} from '../state.jsx';
import {API_URL} from '../api.js';
import {LIVE_POLICIES, fmt} from '../live-data.js';
import {useT, LANGS} from '../i18n.jsx';
import {CountrySelect} from '../CountryPicker.jsx';
import {LIVE_COUNTRY, countryName} from '../countries.js';

export default function Settings(){
  const ctx=useApp(), {t,lang,setLang}=useT(), [draft,setDraft]=useState(ctx.settings), [message,setMessage]=useState('');
  const update=(key,value)=>{setDraft(s=>({...s,[key]:value}));setMessage('');};
  const live=ctx.live.status==='ready'?ctx.live.data:null;
  return <div className="workspace-page px-gutter-desktop py-space-xl">
    <header><span className="results-eyebrow">{t('WORKSPACE')}</span><h1>{t('Settings')}</h1><p>{t('Customize your workspace and default queue view.')}</p></header>
    <form onSubmit={e=>{e.preventDefault();try{ctx.saveSettings({...draft,name:draft.name.trim()||'Demo workspace'});setMessage(t('Settings saved. Queue defaults applied.'));}catch{setMessage(t('Settings could not be saved in this browser. Please try again.'));}}}>
      <section className="results-panel"><h2>{t('Workspace preferences')}</h2><div className="settings-fields">
        <label>{t('Language')}<select value={lang} onChange={e=>setLang(e.target.value)}>{Object.keys(LANGS).map(code=><option key={code} value={code}>{code==='tr'?'Türkçe':'English'}</option>)}</select></label>
        <label>{t('Workspace country')}<CountrySelect value={draft.country||LIVE_COUNTRY} onChange={c=>update('country',c)}/><small className="settings-hint">{t('Sets the queue, the grid emission factors and the prediction model.')}</small></label>
        <label>{t('Workspace name')}<input required maxLength={48} value={draft.name} onChange={e=>update('name',e.target.value)}/></label>
        <label>{t('Default review policy')}<select value={draft.policy} onChange={e=>update('policy',Number(e.target.value))}>{LIVE_POLICIES.map((p,i)=><option key={p.key} value={i}>{t(p.label)}</option>)}</select></label>
        <label>{t('Default queue view')}<select value={draft.view} onChange={e=>update('view',e.target.value)}><option value="table">{t('Table view')}</option><option value="gantt">{t('Planned weeks')}</option></select></label>
        <label className="settings-checkbox"><input type="checkbox" checked={draft.compact} onChange={e=>update('compact',e.target.checked)}/><span>{t('Compact table rows')}</span></label>
      </div><p>{t('Saved in this browser.')}</p></section>
      <section className="results-panel"><h2>{t('Data connection')}</h2><dl className="settings-reference">
        <div><dt>{t('Backend')}</dt><dd>{API_URL} · {t(ctx.live.status==='ready'?'connected':ctx.live.status==='loading'?'connecting':'unavailable')}</dd></div>
        <div><dt>{t(ctx.country===LIVE_COUNTRY?'Live queue snapshot':'Country queue')}</dt><dd>{live?(ctx.country===LIVE_COUNTRY?'':countryName(ctx.country)+' · ')+t('{d} · {r} ranked, {c} awaiting confirmation',{d:live.as_of,r:live.files.length,c:live.needs_confirmation.length}):'—'}</dd></div>
        <div><dt>{t('Weekly reviewer capacity')}</dt><dd>{live?t('{h} hours (calibration year {y})',{h:fmt(live.calibration.capacity_hours_per_week,0),y:live.calibration.calibration_year||2023}):'—'}</dd></div>
        <div><dt>{t('Emission factors used (tCO₂e/MWh)')}</dt><dd>{live?.emission_factor_tco2_per_mwh?Object.entries(live.emission_factor_tco2_per_mwh).map(([k,v])=>`${t(k)} ${v}`).join(' · '):live?t('Per project: official factor of its country (Turkey: ETKB), otherwise UNFCCC IFI harmonised factors'):'—'}</dd></div>
      </dl></section>
      <div className="settings-actions"><span role="status">{message}</span><button type="button" className="queue-control" onClick={()=>{setDraft(ctx.settings);setMessage(t('Unsaved changes discarded.'));}}>{t('Discard changes')}</button><button type="submit" className="settings-save">{t('Save settings')}</button></div>
    </form>
  </div>;
}
