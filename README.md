# CONTROL - Sistema de Gestión de Flota

Sistema SPA (Vite + React) con backend Node.js para gestión de flota de vehículos, incluyendo:
- 📊 Dashboard de métricas y monitoreo
- 🚗 Importación resiliente de activos (solo CAMIONETAS PROPIAS)
- 📝 Generación de órdenes de trabajo (OT) y PDF
- 📈 Historial de kilometraje y mantenimientos
- 🔐 Autenticación JWT

---

## 🚀 Nuevo: Importación de Activos

✅ **Sistema de importación implementado** con filtrado automático:
- Solo importa **CAMIONETAS** y **PICKUP**
- Solo importa activos **PROPIOS**
- Resiliente: continúa aunque algunos registros fallen
- Soporta 11 columnas estándar (ver [PLANTILLA_IMPORTACION_ACTIVOS.md](PLANTILLA_IMPORTACION_ACTIVOS.md))

### Quick Start - Importación

```bash
cd server
node import_assets.js activos_ejemplo.csv
```

📖 **Documentación completa:**
- [PLANTILLA_IMPORTACION_ACTIVOS.md](PLANTILLA_IMPORTACION_ACTIVOS.md) - Guía detallada
- [RESUMEN_IMPLEMENTACION_ACTIVOS.md](RESUMEN_IMPLEMENTACION_ACTIVOS.md) - Cambios implementados
- [COMANDOS_RAPIDOS.md](COMANDOS_RAPIDOS.md) - Referencia rápida
- [server/README.md](server/README.md) - Documentación del servidor

---

## 🛠️ Deploy & Backend Setup (Render + PostgreSQL + Prisma)

1) Create a managed PostgreSQL in Render (or external). Copy the `DATABASE_URL`.

2) Add two services in Render or use `render.yaml` (this repo includes a `render.yaml`):
	- Static Site: build `npm install && npm run build`, publish `dist`
	- Web Service (Node): build `cd server && npm install && npx prisma generate && npm run prisma:migrate`, start `cd server && npm start`

3) In the Render Dashboard for the web service, set environment variables:
	- `DATABASE_URL` = your postgres connection string (postgres://...)
	- `JWT_SECRET` = a secure random string

4) Local testing (from repo root):

```bash
# frontend
npm install
npm run dev

# server (in new terminal)
cd server
npm install
# create DB and run migrations on production: use `npx prisma migrate dev` locally or `npx prisma migrate deploy` on Render
npx prisma generate
npx prisma migrate dev --name init
node src/seed.js   # creates admin@example.com and user@example.com
node src/index.js
```

5) Login endpoint: `POST /api/login` (server port default 4000). Body: `{ "email": "admin@example.com", "password": "AdminPass123!" }`. Returns JWT.
