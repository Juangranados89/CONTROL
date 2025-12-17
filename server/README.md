# Servidor API - CONTROL

API Backend para gestión de flota de vehículos con importación resiliente de activos.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL

# Ejecutar migraciones
npx prisma migrate deploy

# Generar cliente Prisma
npx prisma generate

# Ejecutar seed (crear usuarios de ejemplo)
npm run seed

# Iniciar servidor
npm start
```

## 📦 Importación de Activos

### Estructura de Archivo CSV

El sistema acepta archivos CSV con las siguientes columnas (separadas por `;`):

```
CODIGO DEL EQUIPO;FAMILIA/TIPOLOGÍA;DESCRIPCIÓN;PLACA;MARCA;MODELO / LINEA;SERIE CHASIS / VIN;SERIE MOTOR;AÑO MODELO;ESTADO ACTUAL;UBICACIÓN O FRENTE DE OBRA
```

Ver [activos_ejemplo.csv](activos_ejemplo.csv) para un ejemplo completo.

### Filtros Automáticos (Resiliente)

El sistema **solo importa**:
- ✅ **CAMIONETAS** o **PICKUP** (campo `FAMILIA/TIPOLOGÍA`)
- ✅ **PROPIOS** (campo propietario debe contener "PROPIO")

Cualquier registro que **NO cumpla** estos criterios será:
- Rechazado automáticamente
- Reportado en la respuesta
- No afectará otros registros válidos

### Importar desde CSV (Script Node.js)

```bash
# Importar archivo CSV
node import_assets.js activos_ejemplo.csv

# Con URL personalizada
API_URL=http://localhost:3001/api node import_assets.js mi_archivo.csv
```

### Importar vía API (cURL)

```bash
# Mapear CSV a JSON y enviar
curl -X POST http://localhost:3001/api/vehicles/bulk \
  -H "Content-Type: application/json" \
  -d '[
    {
      "code": "C001",
      "plate": "ABC123",
      "familiaTipologia": "CAMIONETA",
      "descripcion": "CAMIONETA TOYOTA HILUX",
      "brand": "TOYOTA",
      "model": "HILUX 4X4",
      "serieChasis": "5TFHY5F15JX123456",
      "serieMotor": "2TR1234567",
      "anioModelo": "2023",
      "estadoActual": "ACTIVO",
      "ubicacionFrente": "BOGOTÁ",
      "owner": "PROPIO"
    }
  ]'
```

### Respuesta del Endpoint

```json
{
  "success": true,
  "imported": 5,
  "vehicles": [...],
  "filtered": 0,
  "filteredRecords": [],
  "failed": 0,
  "errors": undefined,
  "summary": {
    "total": 5,
    "imported": 5,
    "filteredOut": 0,
    "failed": 0
  }
}
```

## 🗄️ Esquema de Base de Datos

### Modelo Vehicle (Activos)

```prisma
model Vehicle {
  id                   String    @id @default(cuid())
  code                 String    @unique  // CODIGO DEL EQUIPO
  plate                String    @unique  // PLACA
  model                String             // MODELO / LINEA
  brand                String?            // MARCA
  owner                String?            // Propio/Tercero
  familiaTipologia     String?            // FAMILIA/TIPOLOGÍA
  descripcion          String?            // DESCRIPCIÓN
  serieChasis          String?            // SERIE CHASIS / VIN
  serieMotor           String?            // SERIE MOTOR
  anioModelo           String?            // AÑO MODELO
  estadoActual         String?            // ESTADO ACTUAL
  ubicacionFrente      String?            // UBICACIÓN O FRENTE DE OBRA
  mileage              Int       @default(0)
  lastMaintenance      Int?
  lastMaintenanceDate  String?
  vin                  String?
  area                 String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  
  @@index([familiaTipologia])
  @@index([owner])
}
```

## 📡 Endpoints API

### Vehículos

- `GET /api/vehicles` - Listar todos los vehículos
- `GET /api/vehicles/:identifier` - Obtener vehículo por placa o código
- `POST /api/vehicles` - Crear/actualizar un vehículo
- `POST /api/vehicles/bulk` - **Importación masiva resiliente**
- `DELETE /api/vehicles/:id` - Eliminar vehículo

### Variables (Kilometraje)

- `GET /api/variables` - Historial de kilometraje
- `POST /api/variables` - Registrar kilometraje (actualización inteligente)

### Órdenes de Trabajo

- `GET /api/workorders` - Listar órdenes de trabajo
- `POST /api/workorders` - Crear orden de trabajo
- `PATCH /api/workorders/:id` - Actualizar estado de OT
- `POST /api/vehicles/sync-maintenance` - Sincronizar mantenimientos

## 🔧 Migraciones de Base de Datos

```bash
# Crear nueva migración
npx prisma migrate dev --name nombre_migracion

# Aplicar migraciones en producción
npx prisma migrate deploy

# Regenerar cliente Prisma
npx prisma generate

# Ver estado de migraciones
npx prisma migrate status

# Abrir Prisma Studio (GUI)
npx prisma studio
```

## 🔑 Variables de Entorno

Crear archivo `.env` en la raíz de `server/`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/control_db"
PORT=3001
NODE_ENV=development
JWT_SECRET=tu_secreto_jwt_aqui
```

## 📋 Scripts Disponibles

```json
{
  "start": "node src/index.js",
  "dev": "nodemon src/index.js",
  "seed": "node src/seed.js",
  "migrate": "prisma migrate dev",
  "generate": "prisma generate",
  "studio": "prisma studio"
}
```

## 🧪 Pruebas de Importación

### 1. Verificar que el servidor esté corriendo

```bash
curl http://localhost:3001/api/vehicles
```

### 2. Importar archivo de ejemplo

```bash
node import_assets.js activos_ejemplo.csv
```

### 3. Verificar resultados

```bash
# Listar vehículos importados
curl http://localhost:3001/api/vehicles

# Obtener vehículo específico
curl http://localhost:3001/api/vehicles/ABC123
```

## 📚 Documentación Adicional

- [PLANTILLA_IMPORTACION_ACTIVOS.md](../PLANTILLA_IMPORTACION_ACTIVOS.md) - Guía completa de importación
- [schema.prisma](prisma/schema.prisma) - Esquema de base de datos
- [api.js](src/api.js) - Rutas API implementadas

## 🐛 Troubleshooting

### Error: No se puede ejecutar npx en PowerShell

```powershell
# Usar node directamente
node "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js" prisma generate
```

### Error: DATABASE_URL no definida

```bash
# Verificar archivo .env
cat .env

# Asegurarse de que existe DATABASE_URL
echo "DATABASE_URL=postgresql://..." > .env
```

### Error: Prisma Client no encontrado

```bash
# Regenerar cliente
npx prisma generate

# O con node directo
node "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js" prisma generate
```

## 🚀 Despliegue en Producción

### Render.com (PostgreSQL)

1. Crear servicio Web en Render
2. Configurar variables de entorno:
   - `DATABASE_URL` (del servicio PostgreSQL)
   - `NODE_ENV=production`
   - `JWT_SECRET=...`
3. Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
4. Start Command: `npm start`

### Usar Railway/Heroku

Similar, asegurarse de:
- Configurar DATABASE_URL desde el addon PostgreSQL
- Ejecutar migraciones en build: `npx prisma migrate deploy`
- Generar cliente: `npx prisma generate`

## 📊 Monitoreo

```bash
# Ver logs en tiempo real
tail -f logs/server.log

# Verificar salud del servidor
curl http://localhost:3001/health

# Abrir Prisma Studio para explorar datos
npx prisma studio
```

## 🤝 Contribuir

1. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
2. Hacer cambios y commit: `git commit -am 'Agregar nueva funcionalidad'`
3. Push a la rama: `git push origin feature/nueva-funcionalidad`
4. Crear Pull Request

## 📄 Licencia

MIT
