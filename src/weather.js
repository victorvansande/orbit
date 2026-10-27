/* ---- Weer in de focusmodus ---- */
// Icoon + temperatuur van het huidige weer, met een link naar Kwick. Zelfde weerdienst (Open-Meteo) en zelfde
// iconen als Kwick. Kwick en Orbit delen de origin victorvansande.github.io, dus ook localStorage: de plaats die je in
// Kwick koos (isobar:place) geldt hier ook. Anders je locatie, maar alleen als je die al eens toestond (geen
// onverwachte vraag), en anders Brussel, zoals Kwick.

const KWICK = 'https://victorvansande.github.io/kwick/';
const CACHE_KEY = 'priority-orbit.weather.v2';
const FRESH_MS = 15 * 60 * 1000;
const FALLBACK = { name: 'Brussel', lat: 50.8505, lon: 4.3488 };   // zelfde terugval als Kwick

const KIND = {
  0: ['Helder', 'clear'], 1: ['Overwegend helder', 'clear'], 2: ['Half bewolkt', 'partly'], 3: ['Bewolkt', 'cloudy'],
  45: ['Mist', 'fog'], 48: ['Aanvriezende mist', 'fog'],
  51: ['Lichte motregen', 'drizzle'], 53: ['Motregen', 'drizzle'], 55: ['Zware motregen', 'drizzle'],
  56: ['Aanvriezende motregen', 'sleet'], 57: ['Aanvriezende motregen', 'sleet'],
  61: ['Lichte regen', 'rain'], 63: ['Regen', 'rain'], 65: ['Zware regen', 'rain'], 66: ['IJzel', 'sleet'], 67: ['IJzel', 'sleet'],
  71: ['Lichte sneeuw', 'snow'], 73: ['Sneeuw', 'snow'], 75: ['Zware sneeuw', 'snow'], 77: ['Korrelsneeuw', 'snow'],
  80: ['Lichte buien', 'rain'], 81: ['Buien', 'rain'], 82: ['Zware buien', 'rain'], 85: ['Sneeuwbuien', 'snow'], 86: ['Zware sneeuwbuien', 'snow'],
  95: ['Onweer', 'thunder'], 96: ['Onweer met hagel', 'thunder'], 99: ['Onweer met hagel', 'thunder'],
};

function iconId(kind, day) {
  return { clear: day ? 'w-sun' : 'w-moon', partly: day ? 'w-pcd' : 'w-pcn', cloudy: 'w-cloud', fog: 'w-fog',
    drizzle: 'w-drizzle', rain: 'w-rain', snow: 'w-snow', sleet: 'w-sleet', thunder: 'w-thunder' }[kind] || 'w-cloud';
}

const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

async function findPlace() {
  const kwick = read('isobar:place');
  if (kwick && Number.isFinite(kwick.lat) && Number.isFinite(kwick.lon)) return { name: kwick.name || '', lat: kwick.lat, lon: kwick.lon };
  try {
    const perm = await navigator.permissions?.query({ name: 'geolocation' });
    if (perm?.state === 'granted') {
      const c = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(p => res(p.coords), rej, { timeout: 8000, maximumAge: 3600000 }));
      const lat = +c.latitude.toFixed(3), lon = +c.longitude.toFixed(3);
      return { name: await placeName(lat, lon), lat, lon };
    }
  } catch { /* geen locatie */ }
  return FALLBACK;
}

// Naam bij een locatie, zoals Kwick dat doet (gratis, zonder sleutel); mislukt het, dan zonder naam
async function placeName(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=nl`);
    const j = await r.json();
    return j.city || j.locality || '';
  } catch { return ''; }
}

// Neerslag in het komende uur uit de kwartierwaarden. Geeft een korte zin, of '' als het droog blijft.
const WET = 0.1;   // mm per kwartier
export function rainText(w, now = Date.now()) {
  if (!w.slots?.length) return '';
  const slots = w.slots.filter(s => s.end > now && s.start < now + 3600000);
  const wetAt = slots.findIndex(s => s.mm >= WET);
  if (wetAt < 0) return '';
  const kind = slots.slice(wetAt).some(s => s.snow > 0) ? 'Sneeuw' : 'Regen';
  if (slots[wetAt].start <= now) {
    const dry = slots.slice(wetAt).find(s => s.mm < WET);
    return dry ? `${kind} tot ${dry.label}` : `${kind} het komende uur`;
  }
  return `${kind} vanaf ${slots[wetAt].label}`;
}

async function fetchWeather() {
  const cached = read(CACHE_KEY);
  const place = await findPlace();
  if (cached && Date.now() - cached.at < FRESH_MS && cached.lat === place.lat && cached.lon === place.lon) return cached;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code,is_day,precipitation`
    + '&minutely_15=precipitation,snowfall&forecast_minutely_15=6&past_minutely_15=1&timezone=auto';
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const json = await res.json();
  const c = json.current, m = json.minutely_15 || {}, offset = (json.utc_offset_seconds || 0) * 1000;
  // tijden zijn lokaal voor de plaats; omzetten naar echte tijdstippen, het label blijft de lokale klok
  const slots = (m.time || []).map((t, i) => {
    const start = Date.parse(t + 'Z') - offset;
    return { start, end: start + 900000, mm: m.precipitation?.[i] ?? 0, snow: m.snowfall?.[i] ?? 0, label: t.slice(11, 16) };
  });
  const data = { at: Date.now(), lat: place.lat, lon: place.lon, name: place.name, temp: Math.round(c.temperature_2m), code: c.weather_code, day: !!c.is_day, slots };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* geen opslag */ }
  return data;
}

// Vult de link; zonder internet of bij een fout blijft hij verborgen (of toont hij de laatst bekende stand)
export function createWeather(link) {
  link.href = KWICK;
  let timer = 0;

  function paint(w) {
    const [label, kind] = KIND[w.code] || ['Weer', 'cloudy'];
    link.querySelector('use').setAttribute('href', '#' + iconId(kind, w.day));
    link.querySelector('.fw-temp').textContent = `${w.temp}°`;
    link.querySelector('.fw-place').textContent = w.name || '';
    const rain = rainText(w);
    link.querySelector('.fw-rain').textContent = rain;
    link.querySelector('.fw-rain').hidden = !rain;
    const where = w.name ? ` in ${w.name}` : '';
    link.setAttribute('aria-label', `${label}${where}, ${w.temp} graden${rain ? `. ${rain}` : ''}. Open Kwick`);
    link.title = `${label}${where} · open Kwick`;
    link.hidden = false;
  }

  async function update() {
    try { paint(await fetchWeather()); }
    catch { const c = read(CACHE_KEY); if (c) paint(c); }
  }

  // de regenzin hangt af van de klok: elke minuut opnieuw uit de bewaarde kwartierwaarden
  let tick = 0;
  return {
    // alleen bijwerken zolang de focusmodus aan staat
    start() {
      update(); clearInterval(timer); timer = setInterval(update, FRESH_MS);
      clearInterval(tick); tick = setInterval(() => { const c = read(CACHE_KEY); if (c) paint(c); }, 60000);
    },
    stop() { clearInterval(timer); clearInterval(tick); },
  };
}
