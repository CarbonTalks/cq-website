import React, {useState, useEffect, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {AppContext, Icon} from './state.jsx';
import Queue from './pages/Queue.jsx';
import Project from './pages/Project.jsx';
import Upload from './pages/Upload.jsx';
import Results from './pages/Results.jsx';
import Settings from './pages/Settings.jsx';
import Methodology from './pages/Methodology.jsx';
import './styles.css';
import { compareQueueProjects } from './queue-sort.js';
import {readResultsLocation} from './results-navigation.js';
import {api} from './api.js';
import {LIVE_POLICIES, toRow, reasonFor} from './live-data.js';
import {LangProvider, LangSwitch, useT} from './i18n.jsx';
import {COUNTRIES, LIVE_COUNTRY, countryName} from './countries.js';
import {CountryDialog} from './CountryPicker.jsx';

const routes = ['queue','project','upload','results','settings','methodology'];
const currentRoute = () => { const r = location.hash.slice(2).split('?')[0]; return r === 'simulation' ? 'results' : routes.includes(r) ? r : 'queue'; };
const PAGE_SIZE = 25;
const CQ = LIVE_POLICIES.length - 1;
const defaultSettings = {name:'Demo workspace', policy:CQ, view:'table', compact:false, country:null};
function loadSettings(){try{const saved=JSON.parse(localStorage.getItem('carbonqueue-settings'));return {name:typeof saved?.name==='string'?saved.name.slice(0,48):defaultSettings.name,policy:Number.isInteger(saved?.policy)&&saved.policy>=0&&saved.policy<=CQ?saved.policy:CQ,view:saved?.view==='gantt'?'gantt':'table',compact:saved?.compact===true,country:COUNTRIES.includes(saved?.country)?saved.country:null};}catch{return defaultSettings;}}
const CAPACITY = [p => true, p => p.capacity > 0 && p.capacity < 5, p => p.capacity >= 5 && p.capacity <= 25, p => p.capacity > 25];
const WAIT = [p => true, p => p.wait > 90, p => p.wait > 365];

function App() {
  const {t}=useT();
  const [settings,setSettings]=useState(loadSettings);
  function saveSettings(next){localStorage.setItem('carbonqueue-settings',JSON.stringify(next));setSettings(next);setPolicy(next.policy);setView(next.view);setSort(null);}
  const [route,setRoute]=useState(currentRoute), [search,setSearch]=useState(''), [filters,setFilters]=useState(['',0,0]);
  const [policy,setPolicy]=useState(settings.policy), [view,setView]=useState(settings.view);
  const [notice,setNotice]=useState(''), [mobile,setMobile]=useState(false), [pageIndex,setPageIndex]=useState(0);
  const [resultsLocation,setResultsLocation]=useState(readResultsLocation);
  const [sort,setSort]=useState(null), [navCollapsed,setNavCollapsed]=useState(false);
  const [live,setLive]=useState({status:'loading'}), [selected,setSelected]=useState(null);
  const toggleNavigation=()=>window.matchMedia('(max-width:760px)').matches?setMobile(open=>!open):setNavCollapsed(collapsed=>!collapsed);
  const toggleSort=key=>setSort(s=>({key,direction:s?.key===key?(s.direction==='asc'?'desc':'asc'):(['capacity','carbon'].includes(key)?'desc':'asc')}));
  useEffect(()=> {const cb=()=>{setRoute(currentRoute());setResultsLocation(readResultsLocation());setMobile(false);window.scrollTo(0,0);};window.addEventListener('hashchange',cb);return ()=>window.removeEventListener('hashchange',cb);},[]);
  useEffect(()=>{if(notice){const timer=setTimeout(()=>setNotice(''),4500);return ()=>clearTimeout(timer);}},[notice]);
  // Great Britain reads the imported REPD live queue; every other country its uploaded applications.
  const country = settings.country || LIVE_COUNTRY;
  const loadLive = () => { setLive({status:'loading'}); (country===LIVE_COUNTRY?api.liveQueue():api.countryQueue(country)).then(data=>setLive({status:'ready',data})).catch(error=>setLive({status:'error',error})); };
  useEffect(loadLive, [country]);
  useEffect(()=>setPageIndex(0), [search, filters, policy, sort]);
  const navigate = r => {location.hash='/'+r;};

  const rows = useMemo(() => live.status === 'ready' ? live.data.files.map(toRow) : [], [live]);
  const policyKey = LIVE_POLICIES[policy].key;
  const visible = useMemo(() => {
    const q = search.toLowerCase();
    const out = rows.filter(p => `${p.name} ${p.id} ${p.authority}`.toLowerCase().includes(q)
      && (!filters[0] || p.category === filters[0]) && CAPACITY[filters[1]](p) && WAIT[filters[2]](p));
    return sort ? out.sort((a,b)=>compareQueueProjects(a,b,sort)) : out.sort((a,b)=>a.position[policyKey]-b.position[policyKey]);
  }, [rows, search, filters, sort, policyKey]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = visible.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  function openProject(p) { setSelected(p); navigate('project'); }
  function exportCsv() {
    const header=['Position','REPD ID','Project','Authority','Technology','Capacity MW','Carbon low tCO2e/day','Carbon central','Carbon high','Withdrawal %','Effort h','Waiting days','Lane','Reason'].map(h=>t(h));
    const lines=[header,...visible.map(p=>[p.position[policyKey],p.id,p.name,p.authority,p.tech,p.capacity||'',p.carbon?.[0]??'',p.carbon?.[1]??'',p.carbon?.[2]??'',p.risk,p.effort,p.wait,p.lane,reasonFor(p,policyKey).text])];
    const blob=new Blob(['﻿'+lines.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=`carbonqueue-${policyKey}-${live.data?.as_of||'queue'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(t('{n} applications exported.',{n:visible.length}));
  }

  const ctx={settings,saveSettings,resultsLocation,sort,toggleSort,setSort,filters,search,setSearch,setFilter:(i,n)=>setFilters(f=>f.map((v,j)=>i===j?n:v)),
    policy,setPolicy,view,setView,live,loadLive,country,rows,visible,page,pageIndex,pageCount,setPageIndex,selected,openProject,exportCsv,navigate,setNotice};
  const Page={queue:Queue,project:Project,upload:Upload,results:Results,settings:Settings,methodology:Methodology}[route];
  return <AppContext.Provider value={ctx}>
    <aside id="main-navigation" className={'sidebar '+(mobile?'is-open ':'')+(navCollapsed?'is-collapsed':'')}>
      <button type="button" className="brand" aria-label={t("Toggle navigation")} aria-controls="main-navigation" aria-expanded={mobile || !navCollapsed} onClick={toggleNavigation}><span className="brand-mark"><img src="/carbonqueue-logo.svg" width="36" height="36" alt="" aria-hidden="true" /></span><span className="brand-name"><strong>CarbonQueue</strong><small>{t('PUBLIC ENERGY AUTHORITY')}</small></span></button>
      <div className="nav-group">{[['queue','format_list_numbered','Queue'],['upload','cloud_upload','Upload'],['results','bar_chart','Results']].map(([r,icon,label])=><a key={r} href={'#/'+r} aria-current={route===r?'page':undefined} className={route===r||r==='queue'&&route==='project'?'active':''}><Icon>{icon}</Icon>{t(label)}</a>)}</div>
      <div className="nav-bottom"><div className="nav-group"><small>{t('DOCUMENTATION & OPS')}</small>{[['methodology','menu_book','Methodology'],['settings','settings','Settings']].map(([r,icon,label])=><a key={r} href={'#/'+r} className={route===r?'active':''} aria-current={route===r?'page':undefined}><Icon>{icon}</Icon><span>{t(label)}</span></a>)}</div><div className="jurisdiction"><Icon>verified_user</Icon><div><small>{t('DATA SOURCE')}</small><strong>{country===LIVE_COUNTRY?t('UK REPD · England pending applications'):t('Uploaded applications · {c}',{c:countryName(country)})}</strong></div></div></div>
    </aside>
    {mobile&&<button className="mobile-overlay" aria-label={t("Close navigation")} onClick={()=>setMobile(false)}/>}
    <header className={'topbar '+(navCollapsed?'nav-collapsed':'')}><button type="button" className="mobile-brand-toggle brand-mark" aria-label={t("Toggle navigation")} aria-controls="main-navigation" aria-expanded={mobile} onClick={toggleNavigation}><img src="/carbonqueue-logo.svg" width="36" height="36" alt="" aria-hidden="true" /></button><div className="profile"><a href="#/settings" className="country-chip" title={t('Workspace country')}><Icon>public</Icon>{countryName(country)}</a><LangSwitch/><div><strong>{t('Planning reviewer')}</strong><small>{settings.name}</small></div><span className="avatar">PR</span></div></header>
    <main className={'app-main '+(navCollapsed?'nav-collapsed ':'')+(settings.compact?'compact-tables':'')}>
      {live.status==='error'&&route!=='upload'&&<div className="backend-banner" role="alert"><Icon>cloud_off</Icon><span>{t(live.error.message)}. {t('Start the backend and import the live queue (see README).')}</span><button className="queue-control" onClick={loadLive}>{t('Retry')}</button></div>}
      <Page/>
    </main>
    {!settings.country&&<CountryDialog onChoose={c=>{try{saveSettings({...settings,country:c});}catch{setSettings(s=>({...s,country:c}));}}}/>}
    {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')} aria-label={t("Dismiss")}>×</button></div>}
  </AppContext.Provider>;
}
createRoot(document.getElementById('root')).render(<LangProvider><App/></LangProvider>);
