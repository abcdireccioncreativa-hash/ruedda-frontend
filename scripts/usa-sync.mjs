// Sincroniza lotes de Copart/IAAI (API de Apibara, plan gratis: 100 consultas al mes) → Supabase public.usa_lots.
// Corre una vez al día desde .github/workflows/usa-sync.yml: 3 filas × 1 consulta = ~90 consultas al mes.
// Secretos del repo: APIBARA_KEY y SUPABASE_SERVICE_KEY. Sin secretos en este archivo (el repo es público).
const API = 'https://apibara.tech/api/v1/vehicle-auction/vehicles';
const SUPA = 'https://ltodsegzbbdcaublkgtp.supabase.co/rest/v1';
const KEY = process.env.APIBARA_KEY, SK = process.env.SUPABASE_SERVICE_KEY;
if (!KEY || !SK) { console.error('faltan APIBARA_KEY o SUPABASE_SERVICE_KEY'); process.exit(1); }

const hoy = new Date().toISOString().slice(0, 10);
// filas de la sección (orden = como salen en la app). Para cambiarlas: editar aquí.
const FILAS = [
  { k: 'lujo', t: 'Superdeportivos y lujo', q: { price_min: 25000, auction_date_from: hoy } },
  { k: 'comprar', t: 'Comprar ya', q: { lot_status: 'Buy Now', auction_date_from: hoy } },
  { k: 'hoy', t: 'Cierran hoy', q: { today_only: true } }
];

const ahora = new Date().toISOString();
const grande = u => String(u).replace(/([?&])width=\d+&height=\d+/, '$1width=1200&height=900').replace('_thb.', '_ful.');
const rows = [];
for (const [i, f] of FILAS.entries()) {
  const u = new URL(API);
  Object.entries({ per_page: 20, ...f.q }).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  const r = await fetch(u, { headers: { 'X-API-Key': KEY, accept: 'application/json' } });
  if (!r.ok) { console.error('apibara', f.k, r.status, (await r.text()).slice(0, 300)); continue; }
  const j = await r.json();
  (j.data || []).forEach((v, n) => {
    if (!v.lot_number) return;
    const plat = String(v.platform || '').toLowerCase().includes('iaai') ? 'iaai' : 'copart';
    rows.push({
      id: plat + ':' + v.lot_number, platform: plat, lot_number: String(v.lot_number), vin: v.vin || null,
      year: v.year || null, make: v.make || null, model: v.model || null, title: v.title || null,
      damage: [v.condition && v.condition.primary_damage, v.condition && v.condition.secondary_damage].filter(Boolean).join(' · ') || v.damage || null,
      fuel: (v.vehicle_specs && v.vehicle_specs.fuel_type) || v.fuel_type || null,
      transmission: (v.vehicle_specs && v.vehicle_specs.transmission) || v.transmission || null,
      odometer_mi: v.odometer && v.odometer.mi != null ? v.odometer.mi : null,
      location: (v.location && v.location.display) || null,
      auction_at: (v.auction && v.auction.auction_at) || null,
      current_bid: (v.pricing && v.pricing.current_bid_usd) || 0,
      buy_now: (v.pricing && v.pricing.buy_now_usd) || null,
      erv: (v.pricing && v.pricing.estimated_retail_value_usd) || null,
      // la lista trae miniaturas (400×300): se piden en grande a la misma fuente
      photos: (((v.media && v.media.photos) || []).length ? v.media.photos : ((v.media && v.media.thumbs) || [])).slice(0, 15).map(grande),
      has_360: !!(v.media && v.media.has_360), has_video: !!(v.media && v.media.has_video),
      fila: f.k, fila_titulo: f.t, fila_orden: i, orden: n, updated_at: ahora
    });
  });
  console.log(f.k, (j.data || []).length, 'lotes');
}

// un lote puede salir en dos filas: se queda en la primera
const vistos = new Set(), unicos = rows.filter(x => !vistos.has(x.id) && vistos.add(x.id));
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
if (unicos.length) {
  const up = await fetch(SUPA + '/usa_lots?on_conflict=id', { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(unicos) });
  if (!up.ok) { console.error('supabase upsert', up.status, await up.text()); process.exit(1); }
  // lo que no vino hoy se borra (subastas cerradas o fuera de las filas)
  const del = await fetch(SUPA + '/usa_lots?updated_at=lt.' + encodeURIComponent(ahora), { method: 'DELETE', headers: H });
  if (!del.ok) console.error('supabase limpiar', del.status, await del.text());
}
console.log('listo:', unicos.length, 'lotes en usa_lots');
