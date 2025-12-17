# 📊 Grid de Exportación SAP - Documentación

## 🎯 Descripción

Componente de tabla con encabezados fijos optimizado para copiar/pegar datos directamente en SAP u otros sistemas ERP. Diseñado para facilitar la exportación de activos desde la vista de importación.

## ✨ Características

### 🔒 Encabezados Fijos
- Los encabezados permanecen visibles al hacer scroll
- Diseño tipo sticky header para navegación fácil
- Fondo oscuro para mejor visibilidad

### 📋 Formato Compatible SAP
- **TSV (Tab-Separated Values)**: Formato estándar para SAP
- Compatible con Excel, Google Sheets y otros ERP
- Encoding UTF-8 para caracteres especiales

### 📊 11 Columnas Estándar

| # | Columna | Descripción |
|---|---------|-------------|
| 1 | Código Equipo | Identificador único del activo |
| 2 | Familia/Tipología | Tipo de vehículo (CAMIONETA, etc.) |
| 3 | Descripción | Descripción detallada del equipo |
| 4 | Placa | Placa del vehículo |
| 5 | Marca | Marca del fabricante |
| 6 | Modelo / Línea | Modelo específico |
| 7 | Serie Chasis / VIN | Número VIN o chasis |
| 8 | Serie Motor | Número de serie del motor |
| 9 | Año Modelo | Año de fabricación |
| 10 | Estado Actual | Estado operativo (ACTIVO, OPERATIVO, etc.) |
| 11 | Ubicación / Frente | Ubicación actual del activo |

### 🎨 Interfaz Visual

- **Colores por Estado**: 
  - Verde: ACTIVO
  - Azul: OPERATIVO
  - Amarillo: MANTENIMIENTO
  - Gris: Otros estados

- **Tipografía**:
  - Códigos y VIN en fuente monoespaciada
  - Placas en negrita
  - Tamaños optimizados para lectura

### 🚀 Funcionalidades

#### 1. Copiar Todo
```javascript
// Un clic copia TODA la tabla al portapapeles
// Formato TSV listo para pegar en SAP
```

**Uso:**
1. Clic en "Copiar Todo"
2. Ir a SAP
3. Posicionar cursor en primera celda
4. Ctrl+V

#### 2. Descargar como TXT
- Genera archivo `.txt` con formato TSV
- Nombre automático: `activos_sap_YYYY-MM-DD.txt`
- Listo para importar en batch jobs

#### 3. Selección Manual
- Fallback si clipboard API falla
- Permite seleccionar celdas específicas
- Compatible con navegadores antiguos

## 📝 Uso en la Aplicación

### Flujo de Trabajo

```
1. Cargar archivo CSV/Excel
   ↓
2. Vista Previa de datos
   ↓
3. Clic en "Exportar a SAP"
   ↓
4. Modal con tabla formateada
   ↓
5. Copiar o Descargar
```

### Código de Integración

```jsx
import SAPExportGrid from './components/SAPExportGrid';

// En tu componente
const [showSAPExport, setShowSAPExport] = useState(false);

// Renderizar
{showSAPExport && (
  <SAPExportGrid 
    vehicles={importPreview}
    onClose={() => setShowSAPExport(false)}
  />
)}
```

### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `vehicles` | Array | Lista de vehículos a exportar |
| `onClose` | Function | Callback para cerrar el modal |

### Estructura de Datos Esperada

```javascript
const vehicle = {
  id: "clx123...",
  code: "C001",                      // Requerido
  plate: "ABC123",                   // Requerido
  familiaTipologia: "CAMIONETA",    // Opcional
  descripcion: "TOYOTA HILUX",       // Opcional
  brand: "TOYOTA",                   // Opcional
  model: "HILUX 4X4",               // Requerido
  serieChasis: "5TFHY5F15JX...",    // Opcional (también usa vin)
  serieMotor: "2TR1234567",          // Opcional
  anioModelo: "2023",                // Opcional
  estadoActual: "ACTIVO",            // Opcional
  ubicacionFrente: "BOGOTÁ",         // Opcional (también usa area)
  vin: "5TFHY5F15JX...",            // Alternativa a serieChasis
  area: "BOGOTÁ"                     // Alternativa a ubicacionFrente
};
```

## 🔧 Personalización

### Modificar Columnas

```javascript
// En SAPExportGrid.jsx, modificar array headers:
const headers = [
  'CODIGO DEL EQUIPO',
  'FAMILIA/TIPOLOGÍA',
  // ... agregar o quitar columnas
];

// Actualizar también el mapeo en formatForSAP()
const rows = data.map(v => [
  v.code || '',
  v.familiaTipologia || 'CAMIONETA',
  // ... ajustar valores
]);
```

### Cambiar Estilos

```javascript
// Encabezados
<thead className="sticky top-0 z-10">
  <tr className="bg-gray-800 text-white">
    {/* Personalizar colores */}
  </tr>
</thead>

// Filas alternas
className={`${
  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
} hover:bg-blue-50`}
```

### Formato de Exportación

```javascript
// TSV (actual)
headers.join('\t')
rows.map(row => row.join('\t'))

// CSV alternativo
headers.join(',')
rows.map(row => row.map(v => `"${v}"`).join(','))
```

## 📱 Responsivo

- **Desktop**: Tabla completa con scroll horizontal
- **Tablet**: Scroll horizontal automático
- **Mobile**: Modal full-screen con scroll en ambas direcciones

## ♿ Accesibilidad

- ✅ Títulos semánticos con `<th>`
- ✅ Contraste de colores WCAG AA
- ✅ Navegación por teclado
- ✅ Feedback visual en botones
- ✅ Mensajes de estado descriptivos

## 🐛 Troubleshooting

### Error: Clipboard API no disponible

**Causa**: Navegador no soporta API o página no está en HTTPS

**Solución**: El componente automáticamente cae en modo selección manual

### Datos no se pegan correctamente en SAP

**Causa**: SAP espera formato diferente

**Solución**: 
1. Usar botón "Descargar .txt"
2. Abrir archivo en Notepad
3. Verificar separadores (deben ser tabs)
4. Importar desde archivo en SAP

### Columnas desalineadas

**Causa**: Valores contienen tabs o saltos de línea

**Solución**: Limpiar datos antes:
```javascript
const cleanValue = (v) => 
  String(v || '').replace(/[\t\n\r]/g, ' ').trim();
```

## 📊 Ejemplo de Salida TSV

```tsv
CODIGO DEL EQUIPO	FAMILIA/TIPOLOGÍA	DESCRIPCIÓN	PLACA	MARCA	...
C001	CAMIONETA	CAMIONETA TOYOTA HILUX	ABC123	TOYOTA	...
C002	CAMIONETA	PICKUP CHEVROLET	DEF456	CHEVROLET	...
```

## 🚀 Mejoras Futuras

- [ ] Filtrado de columnas (mostrar/ocultar)
- [ ] Búsqueda inline en la tabla
- [ ] Ordenamiento por columna
- [ ] Exportar a Excel nativo (.xlsx)
- [ ] Presets de formato (SAP, Oracle, etc.)
- [ ] Validación de datos antes de exportar
- [ ] Vista previa del formato final

## 📚 Referencias

- [Clipboard API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
- [SAP Import Formats](https://help.sap.com/docs/)
- [TSV Format Specification](https://en.wikipedia.org/wiki/Tab-separated_values)

## 💡 Tips

1. **Antes de exportar**: Verifica que todos los datos requeridos estén completos
2. **En SAP**: Asegúrate de estar en la transacción correcta antes de pegar
3. **Testing**: Prueba primero con 1-2 registros antes de importar todo
4. **Backup**: Siempre haz backup de datos existentes antes de importación masiva

---

**Desarrollado por**: Juan Felipe Granados  
**Versión**: 1.0  
**Fecha**: Diciembre 2024
