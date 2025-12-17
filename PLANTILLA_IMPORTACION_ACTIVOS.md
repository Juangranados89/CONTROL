# Plantilla de Importación de Activos - CONTROL

## Estructura del Archivo de Importación

La importación de activos acepta archivos CSV/Excel con las siguientes columnas:

### Columnas Requeridas

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `CODIGO DEL EQUIPO` | Código único del equipo | `C001` |
| `PLACA` | Placa del vehículo | `ABC123` |
| `FAMILIA/TIPOLOGÍA` | Tipo de vehículo | `CAMIONETA` |
| `DESCRIPCIÓN` | Descripción del equipo | `CAMIONETA TOYOTA HILUX` |
| `MARCA` | Marca del vehículo | `TOYOTA` |
| `MODELO / LINEA` | Modelo o línea | `HILUX 4X4` |
| `SERIE CHASIS / VIN` | Número de chasis o VIN | `5TFHY5F15JX123456` |
| `SERIE MOTOR` | Número de serie del motor | `2TR1234567` |
| `AÑO MODELO` | Año del modelo | `2023` |
| `ESTADO ACTUAL` | Estado del equipo | `ACTIVO`, `MANTENIMIENTO`, etc. |
| `UBICACIÓN O FRENTE DE OBRA` | Ubicación actual | `BOGOTÁ - ZONA NORTE` |

### Mapeo Interno

El sistema mapea automáticamente las columnas a los campos internos:

```javascript
{
  code: "CODIGO DEL EQUIPO",
  plate: "PLACA",
  familiaTipologia: "FAMILIA/TIPOLOGÍA",
  descripcion: "DESCRIPCIÓN",
  brand: "MARCA",
  model: "MODELO / LINEA",
  serieChasis: "SERIE CHASIS / VIN",
  serieMotor: "SERIE MOTOR",
  anioModelo: "AÑO MODELO",
  estadoActual: "ESTADO ACTUAL",
  ubicacionFrente: "UBICACIÓN O FRENTE DE OBRA",
  vin: "SERIE CHASIS / VIN",  // También se copia al campo VIN
  area: "UBICACIÓN O FRENTE DE OBRA"  // También se copia al campo área
}
```

## Filtros Automáticos (Resiliente)

El sistema aplica **filtros automáticos** para importar únicamente:

### 1. Solo CAMIONETAS
- Verifica que `FAMILIA/TIPOLOGÍA` contenga las palabras:
  - `CAMIONETA`
  - `PICKUP`
- **Insensible a mayúsculas/minúsculas**

### 2. Solo PROPIOS
- Verifica que el campo `owner` (Propietario) sea:
  - `PROPIO`
  - Contenga la palabra `PROPIO`
- **Insensible a mayúsculas/minúsculas**

### Registros Filtrados
Los registros que **NO cumplan** con estos criterios serán:
- ❌ Rechazados automáticamente
- 📊 Reportados en la respuesta del endpoint
- ✅ No afectarán la importación de registros válidos

## Ejemplo de Archivo CSV

```csv
CODIGO DEL EQUIPO;FAMILIA/TIPOLOGÍA;DESCRIPCIÓN;PLACA;MARCA;MODELO / LINEA;SERIE CHASIS / VIN;SERIE MOTOR;AÑO MODELO;ESTADO ACTUAL;UBICACIÓN O FRENTE DE OBRA
C001;CAMIONETA;CAMIONETA TOYOTA HILUX;ABC123;TOYOTA;HILUX 4X4;5TFHY5F15JX123456;2TR1234567;2023;ACTIVO;BOGOTÁ - ZONA NORTE
C002;CAMIONETA;PICKUP CHEVROLET;DEF456;CHEVROLET;COLORADO;1GCGTCE32J1234567;LCV1234567;2022;OPERATIVO;MEDELLÍN - OBRA 1
C003;VOLQUETA;CAMIÓN VOLQUETA;GHI789;KENWORTH;T800;1XKDD49X0JJ123456;ISX15123456;2021;ACTIVO;CALI - ZONA SUR
```

### ¿Qué se importará?

| Código | Familia | Propietario | ¿Se importa? | Razón |
|--------|---------|-------------|--------------|-------|
| C001 | CAMIONETA | PROPIO | ✅ Sí | Cumple ambos filtros |
| C002 | CAMIONETA | PROPIO | ✅ Sí | PICKUP también es válido |
| C003 | VOLQUETA | PROPIO | ❌ No | No es CAMIONETA |

## Uso del Endpoint API

### POST `/api/vehicles/bulk`

Importa múltiples vehículos con filtrado resiliente.

#### Request Body

```json
[
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
    "ubicacionFrente": "BOGOTÁ - ZONA NORTE",
    "owner": "PROPIO"
  }
]
```

#### Response

```json
{
  "success": true,
  "imported": 2,
  "vehicles": [
    { "id": "...", "code": "C001", "plate": "ABC123", ... },
    { "id": "...", "code": "C002", "plate": "DEF456", ... }
  ],
  "filtered": 1,
  "filteredRecords": [
    {
      "code": "C003",
      "plate": "GHI789",
      "reason": "Familia/Tipología \"VOLQUETA\" no es CAMIONETA"
    }
  ],
  "failed": 0,
  "errors": undefined,
  "summary": {
    "total": 3,
    "imported": 2,
    "filteredOut": 1,
    "failed": 0
  }
}
```

## Ejemplo de Uso en Frontend (React)

```javascript
// Importar archivo CSV/Excel
const handleFileImport = async (file) => {
  // Parsear CSV con PapaParse o leer Excel
  const data = await parseFile(file);
  
  // Mapear columnas
  const vehicles = data.map(row => ({
    code: row['CODIGO DEL EQUIPO'],
    plate: row['PLACA'],
    familiaTipologia: row['FAMILIA/TIPOLOGÍA'],
    descripcion: row['DESCRIPCIÓN'],
    brand: row['MARCA'],
    model: row['MODELO / LINEA'],
    serieChasis: row['SERIE CHASIS / VIN'],
    serieMotor: row['SERIE MOTOR'],
    anioModelo: row['AÑO MODELO'],
    estadoActual: row['ESTADO ACTUAL'],
    ubicacionFrente: row['UBICACIÓN O FRENTE DE OBRA'],
    owner: 'PROPIO'  // Asume PROPIO si no viene en el archivo
  }));
  
  // Enviar al backend
  const response = await fetch('/api/vehicles/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vehicles)
  });
  
  const result = await response.json();
  
  console.log(`✅ Importados: ${result.imported}`);
  console.log(`⚠️ Filtrados: ${result.filtered}`);
  console.log(`❌ Errores: ${result.failed}`);
  
  // Mostrar detalles de registros filtrados
  if (result.filteredRecords?.length > 0) {
    console.log('Registros filtrados:', result.filteredRecords);
  }
};
```

## Validaciones Aplicadas

### ✅ Validaciones de Negocio
1. **Código único**: No se permiten códigos duplicados
2. **Placa única**: No se permiten placas duplicadas
3. **Familia = CAMIONETA o PICKUP**: Solo camionetas
4. **Propietario = PROPIO**: Solo vehículos propios

### ⚠️ Campos Opcionales
- `descripcion`
- `serieMotor`
- `anioModelo`
- `estadoActual`
- `ubicacionFrente`

### 🚨 Campos Requeridos
- `code` (CODIGO DEL EQUIPO)
- `plate` (PLACA)
- `familiaTipologia` (FAMILIA/TIPOLOGÍA)
- `owner` (Propietario - debe ser PROPIO)

## Migración de Base de Datos

Después de actualizar el esquema Prisma, ejecuta:

```bash
cd server
npx prisma migrate dev --name add_asset_import_fields
npx prisma generate
```

## Notas Importantes

1. **Resilencia**: El endpoint procesa cada registro individualmente. Si uno falla, los demás continúan.
2. **Upsert**: Si el código ya existe, se actualiza. Si no, se crea nuevo.
3. **Filtrado Automático**: Los registros que no sean CAMIONETA+PROPIO se reportan pero no se importan.
4. **Respuesta Detallada**: El endpoint siempre devuelve un resumen completo de la importación.

## Ejemplo de Respuesta Completa

```json
{
  "success": true,
  "imported": 25,
  "vehicles": [ ... ],
  "filtered": 5,
  "filteredRecords": [
    { "code": "V001", "plate": "AAA111", "reason": "Familia/Tipología \"VOLQUETA\" no es CAMIONETA" },
    { "code": "E002", "plate": "BBB222", "reason": "Owner \"TERCERO\" no es PROPIO" }
  ],
  "failed": 2,
  "errors": [
    { "record": {...}, "error": "Código y Placa son requeridos" }
  ],
  "summary": {
    "total": 32,
    "imported": 25,
    "filteredOut": 5,
    "failed": 2
  }
}
```
