// Maps cq-sim live queue records (served by the backend at /queue/live) to queue rows.
import { locale, translate as t } from './i18n.jsx';

export const TECH = {
  solar: { label: 'Solar PV', icon: 'wb_sunny' },
  onshore_wind: { label: 'Onshore wind', icon: 'air' },
  storage: { label: 'Battery storage', icon: 'battery_charging_full' },
  bioenergy_waste: { label: 'Bioenergy / waste', icon: 'compost' },
  other_renewable: { label: 'Other renewable', icon: 'water_drop' },
};
// Uploaded projects outside the REPD categories (category claim_based) are shown by their technology.
const UPLOAD_TECH = {
  heat_pump: { label: 'Heat pump', icon: 'heat_pump' }, energy_efficiency: { label: 'Energy efficiency', icon: 'bolt' },
  electrification: { label: 'Electrification', icon: 'electric_bolt' }, ev_charging: { label: 'EV charging', icon: 'ev_station' },
  building_retrofit: { label: 'Building retrofit', icon: 'home_work' }, low_carbon_transport: { label: 'Low-carbon transport', icon: 'directions_bus' },
  carbon_capture: { label: 'Carbon capture', icon: 'co2' }, digital_service: { label: 'Digital service', icon: 'devices' },
  hydro: { label: 'Hydro', icon: 'water_drop' }, biomass: { label: 'Biomass', icon: 'compost' }, tidal: { label: 'Tidal', icon: 'waves' },
  wave: { label: 'Wave', icon: 'waves' }, battery: { label: 'Battery storage', icon: 'battery_charging_full' },
};

// Policies available in the live snapshot. Index order is used by settings and policy tabs.
export const LIVE_POLICIES = [
  { key: 'fifo', label: 'FIFO' },
  { key: 'carbon', label: 'Carbon only' },
  { key: 'carbonqueue', label: 'CarbonQueue' },
];

export const LANE_LABELS = {
  max_wait: 'Maximum-wait protection',
  small_quota: 'Small-project quota',
  carbon: 'Carbon impact / reviewer hour',
  unscored: 'Unscored lane',
  fifo: 'Submission order',
};

export function toRow(record) {
  const tech = TECH[record.category] || UPLOAD_TECH[record.technology] || { label: record.technology || record.category, icon: 'bolt' };
  const band = record.daily_tco2;
  return {
    id: record.app_id,
    applicationId: record.application_id,
    name: record.site_name,
    authority: record.authority || '—',
    category: record.category,
    technology: record.technology,
    tech: tech.label,
    icon: tech.icon,
    capacity: record.generation_mw ?? 0,
    hasStorage: Boolean(record.has_storage),
    carbon: band ? [band.low, band.central, band.high] : null,
    // No validated model for this country or type: unknown, never shown as 0%.
    risk: record.p_withdraw_12m == null ? null : Math.round(record.p_withdraw_12m * 1000) / 10,
    effort: record.effort_hours,
    wait: record.wait_days,
    submitted: record.submitted,
    reason: record.reason,
    lane: record.lane,
    position: record.position || {},
    plannedWeek: record.planned_week || {},
  };
}

export const fmt = (value, digits = 1) =>
  value == null || Number.isNaN(value) ? '—' : Number(value).toLocaleString(locale(), { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const small = v => fmt(v, v < 1 ? 2 : 1);

const UNSCORED_WHY = { storage: 'storage', bioenergy_waste: 'bioenergy / waste', other_renewable: 'other renewable' };

// Reason text in the selected language, rebuilt from the lane and the record's numbers
// (the snapshot's own reason text is Turkish and belongs to the CarbonQueue run).
export function laneReason({ lane, wait, capacity, carbon, effort, category }) {
  if (lane === 'max_wait') return t('Maximum-wait protection: waiting {days} days', { days: wait });
  if (lane === 'small_quota') return t('Small-project quota: {mw} MW', { mw: fmt(capacity, 2) });
  if (lane === 'carbon') return t('High carbon impact per reviewer hour: {c} tCO₂e/day ÷ {h} h', { c: small(carbon), h: fmt(effort, 0) });
  if (lane === 'fifo') return t('Submission order');
  const why = UNSCORED_WHY[category] || (capacity ? category : 'capacity not stated');
  return t('Unscored lane ({why}): submission order', { why: t(why) });
}

export function reasonFor(p, policyKey) {
  const base = { wait: p.wait, capacity: p.capacity, carbon: p.carbon?.[1], effort: p.effort, category: p.carbon ? p.category : (p.capacity && !UNSCORED_WHY[p.category] ? 'capacity not stated' : p.category) };
  if (policyKey === 'carbonqueue') return { lane: p.lane, text: laneReason({ ...base, lane: p.lane }) };
  if (policyKey === 'fifo') return { lane: 'fifo', text: laneReason({ ...base, lane: 'fifo' }) };
  return p.carbon
    ? { lane: 'carbon', text: t('Carbon impact: {c} tCO₂e/day', { c: small(p.carbon[1]) }) }
    : { lane: 'unscored', text: laneReason({ ...base, lane: 'unscored' }) };
}
