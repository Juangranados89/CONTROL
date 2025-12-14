# 🏗️ Arquitectura del Sistema de Importación de Activos

## 📌 Resumen
Sistema completo de importación masiva de activos desde Excel/CSV que actualiza toda la aplicación en tiempo real.

---

## 🎯 Componentes Implementados

### 1. **AssetManager Component** (src/App.jsx)
**Ubicación**: Líneas ~1781-2290

#### Estados Agregados
```javascript
const [showImportModal, setShowImportModal] = useState(false);
const [importData, setImportData] = useState('');
const [importPreview, setImportPreview] = useState([]);
const [importMode, setImportMode] = useState('replace'); // 'replace' o 'merge'
```

#### Funciones Principales

##### `parseImportData(text)`
- **Propósito**: Parsea datos pegados desde Excel (separados por tabulaciones)
- **Entrada**: String con datos tabulados
- **Salida**: Array de objetos de vehículos
- **Características**:
  - Reconoce múltiples nombres de columnas (español/inglés)
  - Flexible con orden de columnas
  - Limpia y normaliza datos (mayúsculas, números)
  - Valida mínimo 3 campos (código, placa, modelo)

##### `handleImportPreview()`
- **Propósito**: Genera vista previa antes de importar
- **Flujo**: Parsea datos → Actualiza importPreview → Muestra tabla
- **Validación**: Verifica datos válidos antes de confirmar

##### `handleImportConfirm()`
- **Propósito**: Ejecuta la importación final
- **Modos**:
  - **Replace**: Reemplaza toda la BD
  - **Merge**: Actualiza existentes + agrega nuevos
- **Lógica de Merge**:
  ```javascript
  - Busca por código O placa
  - Si existe → Actualiza
  - Si no existe → Agrega con nuevo ID
  ```

##### `handleFileUpload(e)`
- **Propósito**: Carga archivo CSV/TXT
- **Proceso**: FileReader → readAsText → setImportData

---

## 🔄 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                    FUENTE DE DATOS                          │
│  Excel / CSV / Pegar                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              IMPORTACIÓN (AssetManager)                      │
│  • parseImportData() → Array de vehículos                   │
│  • Validación de campos                                     │
│  • Vista previa                                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              ACTUALIZACIÓN DE ESTADO                         │
│  setFleet(newFleet)                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              PERSISTENCIA (useEffect)                        │
│  localStorage.setItem('fleet_data', JSON.stringify(fleet))  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              PROPAGACIÓN A MÓDULOS                           │
│  ✅ PlanningView                                            │
│  ✅ WorkOrders                                              │
│  ✅ DriversView                                             │
│  ✅ DataLoadView                                            │
│  ✅ AssetManager (actualización inmediata)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI/UX Implementado

### Botón de Importación
```jsx
<button onClick={() => setShowImportModal(true)}>
  <Upload size={16} /> Importar Datos
</button>
```
- **Color**: Verde (diferenciado de otros botones)
- **Ubicación**: Header de Administración de Activos
- **Icono**: Upload (lucide-react)

### Modal de Importación
**Dimensiones**: 900px ancho, max 90vh alto

#### Secciones del Modal:
1. **Instrucciones** (bg-blue-50)
   - Pasos numerados
   - Formato esperado
   - Tips visuales

2. **Modo de Importación** (radio buttons)
   - Reemplazar (⚠️ destructivo)
   - Combinar (✅ seguro)

3. **Carga de Archivo**
   - Input file (CSV, TXT, TSV)
   - onChange → handleFileUpload

4. **Área de Texto**
   - Textarea para pegar datos
   - Font mono para mejor visualización
   - Placeholder con ejemplo real

5. **Vista Previa**
   - Botón "Vista Previa"
   - Tabla scrolleable con datos parseados
   - Contador de activos

6. **Confirmación**
   - Botón deshabilitado si no hay preview
   - Muestra cantidad a importar
   - Color verde para indicar seguridad

---

## 💾 Gestión de Estado

### Estado Global
```javascript
// En App.jsx principal
const [fleet, setFleet] = useState(() => {
  const saved = localStorage.getItem('fleet_data');
  return saved ? JSON.parse(saved) : INITIAL_FLEET;
});
```

### Propagación
```javascript
// Cada vista recibe fleet y setFleet
<PlanningView fleet={fleet} setFleet={setFleet} ... />
<MaintenanceAdminView ... fleet={fleet} setFleet={setFleet} ... />
<AssetManager fleet={fleet} setFleet={setFleet} ... />
```

### Persistencia Automática
```javascript
useEffect(() => {
  localStorage.setItem('fleet_data', JSON.stringify(fleet));
}, [fleet]);
```

---

## 🔒 Validaciones y Seguridad

### Validaciones de Datos
1. **Campos Obligatorios**
   - Código (code)
   - Placa (plate)
   - Modelo (model)

2. **Normalización**
   - Códigos y placas → MAYÚSCULAS
   - Números → parseInt() con limpieza de caracteres
   - Textos → trim()

3. **Valores por Defecto**
   - Año: Año actual
   - Estado: "OPERATIVO"
   - Kilometraje: 0
   - Driver: "PENDIENTE"

### Confirmaciones
```javascript
// Modo Replace
if (!window.confirm(`⚠️ Se reemplazará TODA la base de datos...`)) return;

// Limpiar BD
if (!window.confirm('⚠️ LIMPIAR TODA LA BD...')) return;
if (!window.confirm('⚠️⚠️ ÚLTIMA CONFIRMACIÓN...')) return;
```

---

## 📊 Estructura de Datos

### Objeto Vehicle
```javascript
{
  id: Number,              // Auto-generado
  code: String,            // PVHC001
  plate: String,           // H1234-1
  model: String,           // CAMIONETA RAM
  year: Number,            // 2023
  mileage: Number,         // 45000
  status: String,          // OPERATIVO | MANTENIMIENTO | FUERA DE SERVICIO
  lastMaintenance: Number, // 40000
  driver: String,          // JUAN PEREZ
  vin: String,            // VIN123456
  assignedRoutine: String  // "5000" (KM)
}
```

### Formato de Importación (TSV)
```
Codigo	Placa	Modelo	Año	Kilometraje	Estado	Ultimo Mtto	Conductor	VIN	Rutina
PVHC001	H1234-1	CAMIONETA RAM	2023	45000	OPERATIVO	40000	JUAN PEREZ	VIN123456	5000
```

---

## 🧪 Casos de Prueba

### Caso 1: Importación Replace
```
Input: 3 vehículos nuevos
BD Actual: 168 vehículos
Resultado: 3 vehículos (reemplazo completo)
```

### Caso 2: Importación Merge - Actualización
```
Input: 1 vehículo con código existente
BD Actual: 168 vehículos
Resultado: 168 vehículos (1 actualizado)
```

### Caso 3: Importación Merge - Nuevo
```
Input: 1 vehículo con código nuevo
BD Actual: 168 vehículos
Resultado: 169 vehículos (1 agregado)
```

### Caso 4: Importación Merge - Mixto
```
Input: 5 vehículos (2 existentes + 3 nuevos)
BD Actual: 168 vehículos
Resultado: 171 vehículos (2 actualizados + 3 agregados)
```

---

## 🌐 Compatibilidad

### Navegadores
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ⚠️ IE11 (no soportado)

### Formatos de Archivo
- ✅ CSV (separado por tabulaciones)
- ✅ TSV (Tab-Separated Values)
- ✅ TXT (delimitado por tabs)
- ✅ Pegar desde Excel
- ✅ Pegar desde Google Sheets

---

## 📈 Rendimiento

### Optimizaciones
- **Parsing eficiente**: O(n) donde n = número de filas
- **Vista previa limitada**: Muestra max 100 filas en tabla
- **LocalStorage**: Async write, no bloquea UI
- **React State**: Actualización única con setFleet()

### Límites Recomendados
- **Máximo registros**: 10,000 vehículos
- **Tamaño archivo**: < 5MB
- **Columnas**: Hasta 15 campos

---

## 🔧 Mantenimiento

### Agregar Nueva Columna
1. Actualizar `parseImportData()`:
```javascript
const newFieldIdx = findColumn(['nuevo campo', 'new field']);
// ...
newField: (values[newFieldIdx >= 0 ? newFieldIdx : 10] || '').trim()
```

2. Actualizar interfaz del formulario en AssetManager

3. Actualizar documentación en IMPORTACION_ACTIVOS.md

### Modificar Validación
Editar función `parseImportData()` en línea ~1836

### Cambiar Formato por Defecto
Modificar placeholder del textarea en línea ~2200

---

## 📚 Referencias

### Archivos Principales
- `src/App.jsx` (líneas 1781-2290): AssetManager component
- `src/App.jsx` (líneas 3377-3410): Estado global y persistencia
- `IMPORTACION_ACTIVOS.md`: Documentación de usuario

### Dependencias
- React 18 (useState, useEffect)
- lucide-react (iconos Upload, Search, X, Plus)
- localStorage API (persistencia)

### Estado del Sistema
- ✅ Importación completa
- ✅ Validaciones robustas
- ✅ UI intuitiva
- ✅ Documentación completa
- ✅ Propagación a todos los módulos

---

**Desarrollador**: Juan Felipe Granados  
**Fecha**: Diciembre 2025  
**Versión**: 0.1
