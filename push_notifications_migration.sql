-- push_notifications_migration.sql
-- Corre esto UNA VEZ en el SQL Editor de Supabase (proyecto ltodsegzbbdcaublkgtp).
-- Crea la tabla de suscripciones push + un trigger que dispara el push
-- automáticamente cada vez que se inserta una fila en 'notifications' —
-- así los ~15 puntos del código que ya insertan notificaciones in-app
-- (pujas, mensajes, KYC, etc.) empiezan a mandar push sin tocarlos uno por uno.

-- 1. Tabla de suscripciones (una fila por dispositivo/navegador suscrito)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- 1b. Tabla de tokens nativos (app de Xcode/Android Studio) — formato distinto
-- a una suscripción Web Push, por eso es tabla aparte. Se llena sola cuando
-- el usuario activa notificaciones push DENTRO de la app nativa (no del
-- navegador). Enviar push nativo real requiere ademas configurar APNs
-- (Apple) y Firebase (Android) — ver RUEDDA_IOS_BRIEFING.md — sin eso la
-- tabla igual se llena de tokens pero /api/send-push.js todavia no los usa
-- (por ahora solo manda Web Push; agregar el envio nativo es el siguiente
-- paso, una vez tengas esas credenciales).
create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null,
  created_at timestamptz not null default now()
);
create index if not exists native_push_tokens_user_id_idx on public.native_push_tokens(user_id);
alter table public.native_push_tokens enable row level security;
create policy "usuarios manejan sus propios tokens push nativos"
  on public.native_push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- el usuario solo puede leer/crear/borrar sus PROPIAS suscripciones
create policy "usuarios manejan sus propias suscripciones push"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Extensión pg_net — permite que Postgres haga un HTTP POST desde un trigger
-- (ya viene habilitada en la mayoría de los proyectos Supabase; si el CREATE
-- EXTENSION falla porque ya existe, ignóralo, no es un error real).
create extension if not exists pg_net;

-- 3. Función que llama a /api/send-push cada vez que se inserta una notificación.
-- IMPORTANTE: reemplaza 'e15bbb581a70532303fbfcf6c94e448258eccf815360623c71b366a61e9286df' por un secreto random tuyo (el
-- mismo que vas a poner como PUSH_WEBHOOK_SECRET en las env vars de Vercel) —
-- así el endpoint sabe que la llamada viene de verdad de este trigger y no
-- de cualquiera que le pegue a la URL. Genera uno con: openssl rand -hex 32
create or replace function public.notify_push_on_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://www.ruedda.app/api/send-push',
    headers := jsonb_build_object('Content-Type','application/json','x-push-secret','e15bbb581a70532303fbfcf6c94e448258eccf815360623c71b366a61e9286df'),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'titulo', new.titulo,
      'body', new.body,
      'tipo', new.tipo,
      'source_id', new.source_id,
      'source_type', new.source_type
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_push_on_insert on public.notifications;
create trigger trg_notify_push_on_insert
  after insert on public.notifications
  for each row
  execute function public.notify_push_on_insert();

-- Listo. A partir de aquí, CUALQUIER insert a 'notifications' (sin importar
-- si viene del cliente o de una función serverless) dispara automáticamente
-- una llamada a /api/send-push, que manda el push real a los dispositivos
-- suscritos de ese usuario.
