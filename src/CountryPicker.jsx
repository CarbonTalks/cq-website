import React, { useState } from 'react';
import { useT } from './i18n.jsx';
import { LIVE_COUNTRY, countryName, sortedCountries } from './countries.js';

export function CountrySelect({ value, onChange, id }) {
  const { lang } = useT();  // names follow the interface language
  return <select id={id} value={value || ''} onChange={e => onChange(e.target.value)} key={lang}>
    {sortedCountries().map(([code, name]) => <option key={code} value={code}>{name}</option>)}
  </select>;
}

// First visit: the workspace country decides the queue, emission factors and prediction model.
export function CountryDialog({ onChoose }) {
  const { t, lang } = useT();
  const [country, setCountry] = useState(lang === 'tr' ? 'TR' : LIVE_COUNTRY);
  return <div className="modal-overlay">
    <form className="modal country-dialog" role="dialog" aria-modal="true" aria-labelledby="country-title"
      onSubmit={e => { e.preventDefault(); onChoose(country); }}>
      <h2 id="country-title">{t('Which country will you use CarbonQueue for?')}</h2>
      <p>{t('The queue, the grid emission factors and the prediction model follow this choice. You can change it later in Settings.')}</p>
      <label htmlFor="country-select">{t('Country')}</label>
      <CountrySelect id="country-select" value={country} onChange={setCountry} />
      <p className="country-note">{country === LIVE_COUNTRY
        ? t('Great Britain: the live queue of pending English applications (UK REPD) is loaded.')
        : t('{c}: the queue starts empty and fills with the applications you upload.', { c: countryName(country) })}</p>
      <button type="submit" className="save">{t('Continue')}</button>
    </form>
  </div>;
}
