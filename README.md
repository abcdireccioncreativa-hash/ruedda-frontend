# Ruedda — Frontend

Marketplace y plataforma de subastas de vehículos en tiempo real para Venezuela. Subastas estilo Cars & Bids adaptadas al mercado local, con pagos en bolívares (Pago Móvil) y USDT, verificación KYC, y vitrina de concesionarios.

## Stack

- **Frontend:** Single-file SPA en HTML/CSS/JS vanilla (`index.html`)
- **Backend de datos:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Serverless:** Vercel Functions (`/api/*`)
- **Deploy:** Vercel con cron nativo
- **PWA:** Instalable en iOS/Android, empaquetada como app nativa vía Capacitor

## Estructura

```
ruedda-frontend/
├── index.html                  App principal (SPA)
├── api/                        Vercel Serverless Functions
│   ├── place-bid.js            Validación de pujas server-side
│   ├── auction-close.js        Cierre de subastas (llamado por cron)
│   ├── mod-listing.js          Moderación de publicaciones (superadmin)
│   ├── verify-payment.js       Confirmación de pagos
│   └── subscription-check.js   Validación de suscripciones de concesionarios
├── lib/
│   └── supabase.js             Clientes Supabase (admin + anon)
├── vercel.json                 Config de deploy + cron
├── manifest.json               PWA manifest
└── [módulos auxiliares].html   Deal Meter, OBD2 scanner, verificación KYC, etc.
```

## Decisiones de arquitectura

**¿Por qué los `/api` viven en el repo frontend?**
Es el patrón estándar de Vercel: los serverless functions se despliegan desde el mismo proyecto que el frontend. Vercel detecta automáticamente la carpeta `/api` y la expone como endpoints. Separarlos en otro repo rompería el routing y no aportaría valor. El "backend" lógico (esquema, migraciones, RLS) sí vive en un repo aparte (`ruedda-backend`).

**¿Por qué un single-file SPA?**
Prioriza velocidad de iteración durante la fase de producto. El `index.html` concentra la lógica de UI para deploys instantáneos sin pipeline de build. Es deuda técnica reconocida; el code-splitting está en el roadmap post-producto.

**Modelo de seguridad.**
La autenticación es vía Supabase Auth (JWT). Toda la base de datos opera con Row-Level Security (RLS) activo. El cliente usa la `anon` key (pública por diseño, controlada por RLS). El `service_role` key vive exclusivamente en los serverless functions (server-side), nunca en el cliente. Las pujas se validan a nivel de base de datos: monto mayor al actual, subasta activa y dentro de tiempo.

## Flujo de subastas

1. Usuario publica → estado `revisión`
2. Superadmin aprueba → estado `aprobada`
3. Usuario paga acceso (Pago Móvil / código) → estado `activa`
4. Pujas en tiempo real vía Supabase Realtime
5. Cierre automático vía cron de Vercel (`/api/auction-close`, cada 5 min)

## Deploy

Push a `main` despliega automáticamente en Vercel. El cron nativo (definido en `vercel.json`) ejecuta el cierre de subastas cada 5 minutos.

## Variables de entorno (Vercel)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY` (solo server-side)
- `CRON_SECRET` (autenticación del cron)
