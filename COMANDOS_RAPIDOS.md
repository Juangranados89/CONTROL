# 🚀 Comandos Rápidos - Sistema de Importación de Activos

## ⚙️ Configuración Inicial (Solo una vez)

```bash
# 1. Navegar al directorio del servidor
cd server

# 2. Instalar dependencias (si no está hecho)
npm install

# 3. Generar cliente Prisma con los nuevos campos
npx prisma generate
# O en Windows con PowerShell:
node "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js" prisma generate

# 4. Aplicar migraciones (si usas BD real)
npx prisma migrate deploy
```

## 📥 Importar Activos

### Opción 1: Archivo de Ejemplo (Testing)
```bash
cd server
node import_assets.js activos_ejemplo.csv
```

### Opción 2: Tu Propio Archivo CSV
```bash
cd server
node import_assets.js ruta/a/tu/archivo.csv
```

### Opción 3: Con URL personalizada (producción)
```bash
cd server
API_URL=https://tu-servidor.com/api node import_assets.js archivo.csv
```

## 🔍 Verificar Sistema

```bash
# Verificar que todo esté configurado correctamente
cd server
node verify_setup.js
```

## 📊 Consultar Datos

### Via cURL (API REST)

```bash
# Listar todos los vehículos
curl http://localhost:3001/api/vehicles

# Buscar vehículo por placa
curl http://localhost:3001/api/vehicles/ABC123

# Buscar vehículo por código
curl http://localhost:3001/api/vehicles/C001
```

### Via Prisma Studio (GUI)

```bash
cd server
npx prisma studio
# Abre http://localhost:5555
```

## 🔄 Reimportar/Actualizar

```bash
# El sistema hace upsert automático
# Si el código ya existe -> actualiza
# Si no existe -> crea nuevo

cd server
node import_assets.js activos_actualizados.csv
```

## 🧹 Limpiar y Reiniciar

```bash
# Si necesitas borrar todo y empezar de cero

cd server

# Opción 1: Reset completo de BD (¡CUIDADO! Borra todo)
npx prisma migrate reset

# Opción 2: Borrar solo vehículos vía API
curl -X DELETE http://localhost:3001/api/vehicles/{id}
```

## 🐛 Troubleshooting

### Error: "npx no funciona en PowerShell"
```powershell
# Usar node directamente
node "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js" prisma generate
```

### Error: "Cannot find module @prisma/client"
```bash
cd server
npm install
npx prisma generate
```

### Error: "DATABASE_URL no definida"
```bash
# Crear archivo .env
cd server
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/db" > .env
```

### Error: "Column does not exist: familiaTipologia"
```bash
# Aplicar migración SQL manualmente
cd server
npx prisma migrate deploy
# O ejecutar el SQL de server/prisma/migrations/20241216_add_asset_fields/migration.sql
```

## 📖 Documentación

```bash
# Ver plantilla de importación
cat PLANTILLA_IMPORTACION_ACTIVOS.md

# Ver resumen de implementación
cat RESUMEN_IMPLEMENTACION_ACTIVOS.md

# Ver README del servidor
cat server/README.md
```

## 🧪 Pruebas Rápidas

```bash
# 1. Verificar configuración
cd server
node verify_setup.js

# 2. Importar datos de ejemplo
node import_assets.js activos_ejemplo.csv

# 3. Verificar importación
curl http://localhost:3001/api/vehicles | json_pp

# 4. Ver en Prisma Studio
npx prisma studio
```

## 💾 Backup de Datos

```bash
# Exportar vehículos a JSON
curl http://localhost:3001/api/vehicles > backup_vehiculos_$(date +%Y%m%d).json

# En Windows PowerShell:
curl http://localhost:3001/api/vehicles > "backup_vehiculos_$(Get-Date -Format 'yyyyMMdd').json"
```

## 🔑 Variables de Entorno Importantes

```bash
# Archivo: server/.env

DATABASE_URL="postgresql://user:pass@host:5432/db"
PORT=3001
NODE_ENV=development
JWT_SECRET=tu_secreto_aqui
CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
```

## 📋 Formato CSV Requerido

```csv
CODIGO DEL EQUIPO;FAMILIA/TIPOLOGÍA;DESCRIPCIÓN;PLACA;MARCA;MODELO / LINEA;SERIE CHASIS / VIN;SERIE MOTOR;AÑO MODELO;ESTADO ACTUAL;UBICACIÓN O FRENTE DE OBRA
C001;CAMIONETA;CAMIONETA TOYOTA HILUX;ABC123;TOYOTA;HILUX 4X4;5TFHY5F15JX123456;2TR1234567;2023;ACTIVO;BOGOTÁ
```

**Importante:**
- Separador: `;` (punto y coma)
- Primera fila: encabezados
- Codificación: UTF-8

## 🎯 Criterios de Filtrado Automático

El sistema **solo importa** registros que cumplan:

1. ✅ `FAMILIA/TIPOLOGÍA` contiene:
   - "CAMIONETA" o
   - "PICKUP"

2. ✅ Campo propietario (`owner`) contiene:
   - "PROPIO"

**Todos los demás se reportan como filtrados pero NO se importan.**

## 🆘 Comandos de Emergencia

```bash
# Servidor no responde
cd server
npm start

# Reiniciar servidor en dev mode (con auto-reload)
npm run dev

# Ver logs del servidor
tail -f server/logs/server.log  # Linux/Mac
Get-Content server\logs\server.log -Wait  # Windows

# Probar conexión a BD
cd server
npx prisma db pull  # Descarga esquema actual
```

## 📞 Flujo Completo de Importación

```bash
# 1. Preparar CSV con las 11 columnas requeridas
# 2. Navegar al servidor
cd server

# 3. Verificar sistema
node verify_setup.js

# 4. Importar
node import_assets.js mi_archivo.csv

# 5. Verificar resultados
curl http://localhost:3001/api/vehicles | json_pp

# 6. Ver en GUI (opcional)
npx prisma studio
```

---

💡 **Tip:** Guarda este archivo como referencia rápida. Todos estos comandos están documentados en detalle en los archivos MD principales.
