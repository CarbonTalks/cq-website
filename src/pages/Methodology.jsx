import React from 'react';
import { useT } from '../i18n.jsx';

const go = id => e => { e.preventDefault(); document.getElementById(id).scrollIntoView({behavior:'smooth'}); };

// Long-form text is kept per language here rather than in the phrase dictionary.
const TEXT = {
  en: {
    eyebrow: 'DOCUMENTATION', title: 'Methodology', lead: 'How the queue is ordered, how carbon is estimated, and what the results mean.',
    nav: ['Queue ordering', 'Carbon estimate', 'Prediction model', 'Document evidence', 'Limitations'],
    queue: ['Queue ordering', 'CarbonQueue is decision support: it orders which application a reviewer opens next. It never approves or refuses an application. Each week the reviewer capacity is spent in this order:',
      [['1. Maximum-wait protection', 'Files waiting more than 365 days, oldest first, using at most half of the weekly capacity.'],
       ['2. Unscored lane', 'Storage, bioenergy, other renewables and files without a stated capacity receive their share of effort, in submission order.'],
       ['3. Small-project quota', 'Projects under 1 MW are guaranteed half of their effort share.'],
       ['4. Carbon score', '(1 − withdrawal probability) × daily tCO₂e displaced ÷ reviewer hours, highest first; ties in submission order.']],
      'FIFO and carbon-only orders are produced by the same simulator with the same capacity, so the queue\'s position arrows compare like with like.'],
    carbon: ['Carbon estimate', 'Daily tCO₂e = MW × 24 h × load factor × displacement emission factor. Load factors come from DUKES 2026 table 6.3 (2021–2025 mean: solar 0.105, onshore wind 0.248). Three emission factors give the range: grid average and long-run marginal (Green Book supplementary data, table 1) and gas-fired generation (DUKES 2026 table 5.14), read for the queue year + 2 years to reflect time to operation.',
      'Historical carbon gain compares each policy with FIFO and counts only applications that were actually permitted and not abandoned. The pass-through share α (20 / 50 / 100%) is an assumption: how much of an earlier permission becomes earlier operation.',
      'Projects outside the historical model (heat pumps, efficiency, electrification, charging and other carbon-reduction projects) join the same queue on their own stated annual impact: tonnes CO₂e per year ÷ 365, or MWh per year ÷ 365 × the same emission factors. The agent records the claim with its quote and never converts units; a project without a stated figure goes to a reviewer. The claim is shown as unverified and these projects have no withdrawal prediction. Projects sited outside Great Britain are also queued on their claims, with the grid factors of their country; for Türkiye these are the official factors of the Ministry of Energy (grid average 0.434, combined margin 0.6345, operating margin 0.7279 tCO₂/MWh). Solar and wind outside Great Britain use the stated annual generation, or else the average load factor of the country (Ember, 2021 to 2025). Every other country uses the common dataset of the international financial institutions published by the United Nations climate secretariat (UNFCCC, Harmonized IFI Default Grid Factors 2021 v3.2, 228 countries and territories, CDM Tool 07 combined margin).'],
    model: ['Prediction model', 'A discrete-time CatBoost model trained on the UK Renewable Energy Planning Database predicts, from information known at submission, the probability of withdrawal within 12 months and the distribution of the decision date. It does not predict permission or refusal. Withdrawal prediction is weak (ROC-AUC 0.54–0.64) and changes the order by less than 2%; decision-time prediction beats a technology/recent-years baseline by 12–14%.'],
    evidence: ['Document evidence', 'The extraction agent reads planning PDFs and records every value with its document, page and quote. Quotes are checked against the parsed text. Capacities that refer to a neighbouring scheme, an earlier permission or a grid connection are rejected; when no supported value remains, the field is marked missing and a reviewer enters it. Every correction is stored with the original values, actor, time and reason.'],
    limits: ['Limitations', [
      ['Single reviewer pool', 'Authorities receive only a few renewable files a year, so the simulation assumes one England-wide pool.'],
      ['Calibration', 'Capacity is calibrated to the observed median decision time; the slowest tail (P90) is not reproduced.'],
      ['Sensitivity to capacity', 'The gain grows when the queue is more congested; results should be read as a range, not a single number.'],
      ['Effort', 'Reviewer hours per file are not public; effort is rule-based.']]],
  },
  tr: {
    eyebrow: 'DOKÜMANTASYON', title: 'Yöntem', lead: 'Kuyruk nasıl sıralanıyor, karbon nasıl tahmin ediliyor ve sonuçlar ne anlama geliyor.',
    nav: ['Kuyruk sıralaması', 'Karbon tahmini', 'Tahmin modeli', 'Belge kanıtı', 'Sınırlamalar'],
    queue: ['Kuyruk sıralaması', 'CarbonQueue bir karar destek sistemidir: uzmanın sıradaki hangi başvuruyu açacağını belirler. Hiçbir başvuruya izin ya da ret vermez. Her hafta uzman kapasitesi şu sırayla harcanır:',
      [['1. Azami bekleme koruması', '365 günden uzun bekleyen dosyalar, en eskiden başlayarak; haftalık kapasitenin en fazla yarısı.'],
       ['2. Skorsuz yol', 'Depolama, biyoenerji, diğer yenilenebilir ve kapasitesi yazmayan dosyalar efor payları kadar kapasite alır, başvuru sırasıyla ilerler.'],
       ['3. Küçük proje kotası', '1 MW altındaki projeler efor paylarının yarısını garanti alır.'],
       ['4. Karbon skoru', '(1 − geri çekilme olasılığı) × günlük yer değiştirilen tCO₂e ÷ uzman saati; en yüksekten başlayarak, eşitlikte başvuru sırası.']],
      'FIFO ve sadece karbon sıraları aynı simülatörle ve aynı kapasiteyle üretilir; kuyruktaki sıra değişimi okları bu yüzden eşit koşulları karşılaştırır.'],
    carbon: ['Karbon tahmini', 'Günlük tCO₂e = MW × 24 saat × yük faktörü × yer değiştirme emisyon faktörü. Yük faktörleri DUKES 2026 tablo 6.3\'ten (2021–2025 ortalaması: güneş 0,105, kara rüzgârı 0,248). Bant üç emisyon faktöründen gelir: şebeke ortalaması ve uzun dönem marjinal (Green Book ek veri tabloları, tablo 1) ile gaz santrali üretimi (DUKES 2026 tablo 5.14). İşletmeye geçiş süresi için faktör kuyruk yılı + 2 yıl için okunur.',
      'Geçmiş karbon kazancı her politikayı FIFO ile karşılaştırır ve yalnızca gerçekten izin almış, terk edilmemiş başvuruları sayar. Yansıma oranı α (%20 / %50 / %100) bir varsayımdır: iznin erken çıkmasının ne kadarının işletmeye erken girmeye dönüştüğü.',
      'Geçmiş modelin kapsamı dışındaki projeler (ısı pompası, verimlilik, elektrifikasyon, şarj altyapısı ve diğer karbon azaltım projeleri) aynı kuyruğa kendi beyan ettikleri yıllık etkiyle girer: yıllık ton CO₂e ÷ 365 ya da yıllık MWh ÷ 365 × aynı emisyon faktörleri. Ajan beyanı alıntısıyla kaydeder, birim dönüştürmez; rakam belirtmeyen proje uzmana gider. Beyan doğrulanmamış olarak gösterilir ve bu projeler için geri çekilme tahmini yapılmaz. İngiltere dışındaki projeler de beyanlarıyla, o ülkenin şebeke faktörleriyle kuyruğa girer; Türkiye için bunlar Enerji ve Tabii Kaynaklar Bakanlığı tarafından yayımlanan resmi faktörlerdir (şebeke ortalaması 0,434, birleşik marj 0,6345, faaliyet temelli marj 0,7279 tCO₂/MWh). Büyük Britanya dışındaki güneş ve rüzgârda belgedeki yıllık üretim, yoksa ülkenin ortalama yük faktörü (Ember, 2021–2025) kullanılır. Diğer bütün ülkelerde Birleşmiş Milletler İklim Sekretaryası (UNFCCC) sitesinde yayımlanan, uluslararası finans kuruluşlarının ortak veri seti kullanılır (Harmonized IFI Default Grid Factors 2021 v3.2; 228 ülke ve bölge; CDM Tool 07 birleşik marjı).'],
    model: ['Tahmin modeli', 'İngiltere Yenilenebilir Enerji Planlama Veritabanı (REPD) ile eğitilen ayrık zamanlı bir CatBoost modeli, başvuru anında bilinen bilgilerle 12 ay içinde geri çekilme olasılığını ve karar tarihinin dağılımını tahmin eder. İzin ya da ret tahmini yapmaz. Geri çekilme tahmini zayıftır (ROC-AUC 0,54–0,64) ve sıralamayı %2\'den az değiştirir; karar süresi tahmini, teknoloji ve son yıllara dayalı taban çizgiden %12–14 daha iyidir.'],
    evidence: ['Belge kanıtı', 'Çıkarma ajanı planlama PDF\'lerini okur ve her değeri belgesi, sayfası ve alıntısıyla kaydeder. Alıntılar ayrıştırılan metinle karşılaştırılır. Komşu bir projeye, önceki bir izne ya da şebeke bağlantısına ait kapasiteler reddedilir; destekli bir değer kalmazsa alan eksik işaretlenir ve uzman girer. Her düzeltme özgün değerler, yapan kişi, zaman ve gerekçeyle saklanır.'],
    limits: ['Sınırlamalar', [
      ['Tek uzman havuzu', 'Kurumlara yılda yalnızca birkaç yenilenebilir dosya düştüğü için simülasyon İngiltere geneli tek bir havuz varsayar.'],
      ['Kalibrasyon', 'Kapasite gözlenen medyan karar süresine göre ayarlanır; en yavaş uç (P90) yeniden üretilemez.'],
      ['Kapasiteye duyarlılık', 'Kuyruk ne kadar sıkışıksa kazanç o kadar büyür; sonuçlar tek bir sayı değil, aralık olarak okunmalıdır.'],
      ['Efor', 'Dosya başına uzman saati kamuya açık değildir; efor kural tabanlıdır.']]],
  },
};

export default function Methodology(){
  const { lang } = useT();
  const T = TEXT[lang] || TEXT.en;
  const ids = ['method-queue', 'method-carbon', 'method-model', 'method-evidence', 'method-limits'];
  return <div className="workspace-page px-gutter-desktop py-space-xl">
    <header><span className="results-eyebrow">{T.eyebrow}</span><h1>{T.title}</h1><p>{T.lead}</p></header>
    <nav className="historical-section-picker" aria-label={T.title}>{T.nav.map((label, i) => <a key={ids[i]} href={'#' + ids[i]} onClick={go(ids[i])}>{label}</a>)}</nav>
    <section className="results-panel" id="method-queue"><h2>{T.queue[0]}</h2><p>{T.queue[1]}</p><dl className="settings-reference">{T.queue[2].map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}</dl><p>{T.queue[3]}</p></section>
    <section className="results-panel" id="method-carbon"><h2>{T.carbon[0]}</h2><p>{T.carbon[1]}</p><p>{T.carbon[2]}</p><p>{T.carbon[3]}</p></section>
    <section className="results-panel" id="method-model"><h2>{T.model[0]}</h2><p>{T.model[1]}</p></section>
    <section className="results-panel" id="method-evidence"><h2>{T.evidence[0]}</h2><p>{T.evidence[1]}</p></section>
    <section className="results-panel" id="method-limits"><h2>{T.limits[0]}</h2><dl className="settings-reference">{T.limits[1].map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}</dl></section>
  </div>;
}
