-- ============================================================================
-- RUEDDA REPUESTOS · 14_mock_media.sql
-- ----------------------------------------------------------------------------
-- Solo para el ambiente de pruebas: le pone fotos (picsum.photos, estable por
-- seed — la misma URL siempre devuelve la misma foto, no es aleatorio en
-- cada carga) a todo lo que el seed demo dejo sin imagen, agrega productos en
-- las categorias que todavia no tenian ninguno, y siembra un par de
-- herramientas en alquiler para que ese flujo tambien se vea con datos.
-- Nada de esto toca ordenes/pagos/usuarios reales — es contenido de catalogo.
-- Correr en el SQL Editor de Supabase, proyecto ltodsegzbbdcaublkgtp.
-- Idempotente (los UPDATE solo tocan filas sin imagen; los INSERT usan
-- on conflict do nothing donde aplica).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. FOTOS de lo que ya existe
-- ---------------------------------------------------------------------------
update repuestos.products
set images = array['https://picsum.photos/seed/rr-' || id::text || '/700/500']
where cardinality(images) = 0;

update repuestos.stores
set logo_url = coalesce(logo_url, 'https://picsum.photos/seed/rr-logo-' || id::text || '/200/200'),
    banner_url = coalesce(banner_url, 'https://picsum.photos/seed/rr-banner-' || id::text || '/1200/400');

update repuestos.sponsors
set image_url = 'https://picsum.photos/seed/rr-sponsor-' || id::text || '/900/400'
where image_url is null;

update repuestos.home_dots
set image_url = 'https://picsum.photos/seed/rr-dot-' || id::text || '/300/300'
where image_url is null;

update repuestos.categories
set image_url = 'https://picsum.photos/seed/rr-cat-' || id || '/700/500'
where image_url is null;

update repuestos.part_categories
set image_url = 'https://picsum.photos/seed/rr-pc-' || id || '/700/500'
where image_url is null;

update repuestos.mechanics
set fotos = array['https://picsum.photos/seed/rr-mec-' || id::text || '/500/500']
where fotos = '{}';

-- ---------------------------------------------------------------------------
-- 2. PRODUCTOS NUEVOS en categorias que todavia no tenian ninguno
--    (embrague, rodamientos, distribucion, iluminacion, accesorios)
-- ---------------------------------------------------------------------------
insert into repuestos.products (store_id, brand, part_category_id, origins, name, part_number, model, medida, price_usd, stock, status, images)
select v.store_id, v.brand, v.part_category_id, v.origins, v.name, v.part_number, v.model, v.medida, v.price_usd, v.stock, 'published', v.images
from (values
    ('22222222-2222-4222-8222-222222222222'::uuid, 'LUK', 'pc-embrague', array['euro']::text[], 'Kit de embrague LUK RepSet', 'LUK-6243206',
      'Corolla / Sentra', '3 piezas', 189.00::numeric, 6, array['https://picsum.photos/seed/rr-luk-embrague/700/500']::text[]),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'Valeo', 'pc-embrague', array['euro']::text[], 'Disco de embrague Valeo', 'VAL-826880',
      'Aveo / Spark', '190mm', 68.00, 10, array['https://picsum.photos/seed/rr-valeo-embrague/700/500']),
    ('11111111-1111-4111-8111-111111111111'::uuid, 'SKF', 'pc-rodamientos', array['euro']::text[], 'Rodamiento de rueda delantero SKF', 'SKF-VKBA3550',
      'Hilux / Vitara', 'delantero', 47.00, 15, array['https://picsum.photos/seed/rr-skf-rodamiento/700/500']),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'Timken', 'pc-rodamientos', array['americano']::text[], 'Rodamiento trasero Timken', 'TIM-512345',
      'Ford / Chevrolet', 'trasero', 39.00, 12, array['https://picsum.photos/seed/rr-timken-rodamiento/700/500']),
    ('11111111-1111-4111-8111-111111111111'::uuid, 'Gates', 'pc-distrib', array['asiatico']::text[], 'Kit de distribucion Gates (correa + tensores)', 'GAT-K025667',
      'Corolla 1.8 / Aveo', 'kit completo', 95.00, 8, array['https://picsum.photos/seed/rr-gates-distribucion/700/500']),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'Dayco', 'pc-distrib', array['asiatico']::text[], 'Correa de distribucion Dayco', 'DAY-941190',
      'Hilux 2.7', 'reforzada', 54.00, 10, array['https://picsum.photos/seed/rr-dayco-distribucion/700/500']),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'Philips', 'pc-ilum', array['euro']::text[], 'Bombillo Philips H4 Vision', 'PHI-12342PRC2',
      'universal', 'H4 12V 60/55W', 14.00, 40, array['https://picsum.photos/seed/rr-philips-ilum/700/500']),
    ('11111111-1111-4111-8111-111111111111'::uuid, 'Osram', 'pc-ilum', array['euro']::text[], 'Kit de LED Osram para faro delantero', 'OSR-64210',
      'universal', 'H7 LED', 42.00, 20, array['https://picsum.photos/seed/rr-osram-ilum/700/500']),
    ('33333333-3333-4333-8333-333333333333'::uuid, '3M', 'pc-acc', array['euro','americano','asiatico']::text[], 'Kit de limpieza y proteccion de tablero 3M', '3M-39030',
      'universal', 'kit', 22.00, 25, array['https://picsum.photos/seed/rr-3m-acc/700/500']),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'Rain-X', 'pc-acc', array['americano']::text[], 'Plumillas Rain-X Latitude (par)', 'RX-5079281',
      'universal', '22" / 19"', 28.00, 18, array['https://picsum.photos/seed/rr-rainx-acc/700/500'])
  ) as v(store_id, brand, part_category_id, origins, name, part_number, model, medida, price_usd, stock, images)
where not exists (select 1 from repuestos.products p where p.part_number = v.part_number);

-- registra las marcas nuevas en el catalogo de "ver marcas" (no rompe nada si
-- ya existen: la unicidad es por nombre + categoria)
insert into repuestos.brands (name, category, oficial) values
  ('LUK','embrague',false), ('Valeo','embrague',false),
  ('SKF','rodamientos',false), ('Timken','rodamientos',false),
  ('Gates','distribucion',false), ('Dayco','distribucion',false),
  ('Philips','iluminacion',false), ('Osram','iluminacion',false),
  ('3M','accesorios',false), ('Rain-X','accesorios',false)
on conflict (name, category) do nothing;

-- ---------------------------------------------------------------------------
-- 3. HERRAMIENTAS EN ALQUILER de ejemplo (para que el CTA de cada producto
--    ya muestre catalogo real en vez de "Proximamente")
-- ---------------------------------------------------------------------------
insert into repuestos.tool_rentals (store_id, name, description, category, price_usd_day, deposit_usd, zone, image_url, active)
select v.store_id, v.name, v.description, v.category, v.price_usd_day, v.deposit_usd, v.zone, v.image_url, true
from (values
  ('22222222-2222-4222-8222-222222222222'::uuid, 'Extractor de rotulas', 'Para desmontar rotulas de direccion y suspension sin dañarlas.', 'pc-suspension', 8.00::numeric, 25.00::numeric, 'Caracas', 'https://picsum.photos/seed/rr-tool-rotulas/500/400'),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'Compresor de resortes', 'Juego de compresores para cambiar amortiguadores con seguridad.', 'pc-suspension', 10.00, 30.00, 'Caracas', 'https://picsum.photos/seed/rr-tool-compresor/500/400'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'Escaner OBD2 profesional', 'Diagnostico por escaner, lee y borra codigos de falla.', 'pc-motor', 12.00, 40.00, 'Caracas', 'https://picsum.photos/seed/rr-tool-obd2/500/400'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'Kit de herramienta para frenos', 'Separador de pastillas, llave de sangrado y accesorios.', 'pc-frenos', 6.00, 15.00, 'Valencia', 'https://picsum.photos/seed/rr-tool-frenos/500/400'),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'Gato hidraulico de piso (2 ton)', 'Para levantar el vehiculo con seguridad en casa.', 'pc-suspension', 9.00, 20.00, 'Caracas', 'https://picsum.photos/seed/rr-tool-gato/500/400')
) as v(store_id, name, description, category, price_usd_day, deposit_usd, zone, image_url)
where not exists (select 1 from repuestos.tool_rentals t where t.name = v.name and t.store_id = v.store_id);
