import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import 'dotenv/config'
import { Location } from '../models/location.model.js'

countries.registerLocale(en);

export const deriveISO2 = (countryName) => {
    if (!countryName)
        return null
    const normalized = countryName.trim()
        .replace(/^u\.?s\.?a?$/i, 'United States')
        .replace(/^uk$/i, 'United Kingdom');
    return countries.getAlpha2Code(normalized, 'en') || null
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
    { locality, area = '', country },
    { storeRaw = false } = {}) {

    if (!locality || !country) 
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
            provider: storeRaw ? { name: 'maptiler', raw: feature } : { name: 'maptiler' },
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
