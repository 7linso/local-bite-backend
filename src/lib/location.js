import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import 'dotenv/config'
import { Location } from '../models/location.model.js'

countries.registerLocale(en);

const ALIASES = {
  'u.s.': 'United States',
  'u.s.a': 'United States',
  'usa': 'United States',
  'us': 'United States',
  'u.k.': 'United Kingdom',
  'uk': 'United Kingdom',
  'uae': 'United Arab Emirates',
  'r.o.c.': 'Taiwan',
};

export function deriveISO2(countryInput) {
  if (!countryInput) return null;

  const raw = countryInput.trim();
  const lowered = raw.toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');

  if (ALIASES[lowered]) {
    const code = countries.getAlpha2Code(ALIASES[lowered], 'en');
    return code || null;
  }

  if (/^[A-Za-z]{2}$/.test(raw)) {
    const upper = raw.toUpperCase();
    const valid = countries.getName(upper, 'en');
    return valid ? upper : null;
  }

  if (/^[A-Za-z]{3}$/.test(raw)) {
    const upper3 = raw.toUpperCase();
    const all = countries.getNames('en'); 
    const alpha2 = Object.keys(all).find(
      a2 => countries.getAlpha3Code(all[a2], 'en') === upper3
    );
    return alpha2 || null;
  }

  const code = countries.getAlpha2Code(raw, 'en'); 
  if (code) return code;

  const pretty = raw.replace(/\b\w/g, c => c.toUpperCase());
  const code2 = countries.getAlpha2Code(pretty, 'en');
  return code2 || null;
}

export const maptilerGeocode = async (
    locality,
    area,
    country,
    language = 'en',
    limit = 1
) => {
    // in case smth is missing, remove falsy values with filter
    const parts = [locality, area, country].filter(Boolean).join(', ')

    const key = process.env.MAPTILER_API_KEY
    if (!key)
        throw new Error('Missing MAPTILER_API_KEY')

    const url =
        `https://api.maptiler.com/geocoding/${encodeURIComponent(parts)}.json` +
        `?key=${key}&limit=${limit}&language=${encodeURIComponent(language)}`

    const res = await fetch(url)
    if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Geocoding failed: ${res.status} ${res.statusText} ${txt}`)
    }

    const data = await res.json()

    const feat = data?.features?.[0]
    if (!feat)
        throw new Error('No geocoding match')

    const coords =
        (Array.isArray(feat?.geometry?.coordinates) && feat.geometry.coordinates) ||
        (Array.isArray(feat?.center) && feat.center)

    if (!coords || coords.length !== 2)
        throw new Error('Geocoding result missing coordinates')

    const [lon, lat] = coords.map(Number)
    return [lon, lat]
};

const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

const makeKey = (locality, area, countryCode) =>
    [norm(locality), norm(area || ''), norm(countryCode)].join('|')

export async function resolveOrCreateLocation(
    { locality, area, country },
    { storeRaw = false } = {}) {

    if (!locality || !area || !country)
        throw new Error('Missing locality or country')

    const country_code = deriveISO2(country)
    if (!country_code)
        throw new Error('Unknown country name.')

    const key = makeKey(locality, area, country_code)

    // if location is in db, just use it
    const existing = await Location.findOne({ key })
    if (existing) return existing

    // if no, create and store
    const coordinates = await maptilerGeocode(locality, area, country)
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new Error('Geocoding returned invalid coordinates.')
    }

    try {
        return await Location.create({
            key,
            locality,
            area,
            country,
            country_code,
            point: { type: 'Point', coordinates },
            provider: { name: 'maptiler' }
        })
    } catch (e) {
        if (e?.code === 11000) {
            const again = await Location.findOne({ key })
            if (again)
                return again
        }
        throw e
    }
}
