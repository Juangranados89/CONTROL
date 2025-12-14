# 📊 Dashboard - Documentación Técnica

## 🎯 Descripción General
Módulo de visualización de métricas y análisis de gestión de mantenimiento con gráficos interactivos y KPIs en tiempo real.

---

## 🏗️ Arquitectura

### Ubicación en el Código
- **Archivo**: `src/App.jsx`
- **Líneas**: ~302-680
- **Componente**: `Dashboard`
- **Dependencias**: `recharts`, `lucide-react`

### Props del Componente
```javascript
{
  fleet: Array,           // Array de vehículos
  workOrders: Array,      // Array de órdenes de trabajo
  variableHistory: Array  // Historial de variables (futuro uso)
}
```

---

## 📊 Métricas Calculadas (KPIs)

### 1. Métricas de Flota
- **Total de Vehículos**: Cantidad total de activos
- **Vehículos Operativos**: Estado "OPERATIVO"
- **En Mantenimiento**: Estado "MANTENIMIENTO"
- **Fuera de Servicio**: Estado "FUERA DE SERVICIO"
- **Porcentaje de Operatividad**: (Operativos / Total) × 100

### 2. Métricas de Órdenes de Trabajo
- **OTs Abiertas**: Órdenes con estado "ABIERTA"
- **OTs Cerradas**: Órdenes con estado "CERRADA"
- **Total de OTs**: Suma total de órdenes
- **Tasa de Cierre**: (Cerradas / Total) × 100

### 3. Métricas de Mantenimiento
- **Mantenimientos Vencidos**: KM restante < 0
- **Próximos Mantenimientos**: 0 ≤ KM restante < 3000
- **En Regla**: KM restante ≥ 3000

### 4. Métricas de Rango de Ejecución (NUEVO)
- **En Rango de Ejecución**: Vehículos que ejecutan mantenimiento entre -10% y +10% del KM programado
- **Fuera de Rango**: Vehículos que no cumplen con el rango ±10%
- **Cumplimiento de Rango**: (En Rango / Total) × 100
- **Cálculo**: 
  ```javascript
  rangeMin = targetKm * 0.9  // -10%
  rangeMax = targetKm * 1.1  // +10%
  enRango = kmSinceLastMtto >= rangeMin && kmSinceLastMtto <= rangeMax
  ```

### 5. Métricas de Efectividad por Taller (NUEVO)
- **Total OTs por Taller**: Cantidad de órdenes asignadas a cada taller
- **OTs Cerradas**: Órdenes completadas por taller
- **OTs Abiertas**: Órdenes pendientes por taller
- **Efectividad**: (Cerradas / Total) × 100 por cada taller
- **Talleres Monitoreados**:
  - TALLER EL HATO
  - TALLER PR 33
  - TALLER EL BURRO
  - TALLER EXTERNO

---

## 🎨 Componentes Visuales

### Tarjetas KPI (4 Cards)

#### 1. Total Vehículos
- **Color**: Gradiente Azul (from-blue-500 to-blue-600)
- **Ícono**: Car
- **Métrica Principal**: Total de vehículos
- **Métrica Secundaria**: Porcentaje de operatividad

#### 2. OTs Abiertas
- **Color**: Gradiente Verde (from-green-500 to-green-600)
- **Ícono**: ClipboardList
- **Métrica Principal**: Cantidad de OTs abiertas
- **Métrica Secundaria**: Total de OTs y tasa de cierre

#### 3. Mantenimientos Vencidos
- **Color**: Gradiente Rojo (from-red-500 to-red-600)
- **Ícono**: AlertTriangle
- **Métrica Principal**: Vehículos con mantenimiento vencido
- **Métrica Secundaria**: Mensaje de atención inmediata

#### 4. Próximos Mantenimientos
- **Color**: Gradiente Ámbar (from-amber-500 to-amber-600)
- **Ícono**: Clock
- **Métrica Principal**: Vehículos próximos a mantenimiento
- **Métrica Secundaria**: Menos de 3,000 KM restantes

#### 5. Rango de Ejecución ±10% (NUEVO)
- **Color**: Gradiente Púrpura (from-purple-500 to-purple-600)
- **Ícono**: Activity
- **Métrica Principal**: Vehículos en rango de ejecución
- **Métrica Secundaria**: Porcentaje de cumplimiento

---

## 📈 Gráficos Implementados

### 1. Estado de la Flota (Pie Chart)
**Tipo**: Gráfico de Pastel (Pie Chart)
**Librería**: Recharts - PieChart

**Datos**:
```javascript
[
  { name: 'Operativos', value: X, color: '#10b981' },
  { name: 'En Mantenimiento', value: Y, color: '#f59e0b' },
  { name: 'Fuera de Servicio', value: Z, color: '#ef4444' }
]
```

**Características**:
- Radio exterior: 100px
- Labels con nombre, valor y porcentaje
- Colores diferenciados por estado
- Tooltip interactivo

### 2. Estado de Mantenimiento (Donut Chart)
**Tipo**: Gráfico de Dona (Pie Chart con innerRadius)
**Librería**: Recharts - PieChart

**Datos**:
```javascript
[
  { name: 'Vencido', value: X, color: '#ef4444' },
  { name: 'Próximo', value: Y, color: '#f59e0b' },
  { name: 'OK', value: Z, color: '#10b981' }
]
```

**Características**:
- Radio interno: 60px
- Radio externo: 100px
- Muestra estado de mantenimiento por KM
- Colores por criticidad

### 3. Órdenes de Trabajo - Últimos 6 Meses (Area Chart)
**Tipo**: Gráfico de Área con Gradientes
**Librería**: Recharts - AreaChart

**Datos**:
```javascript
[
  { 
    month: 'Nov 2025',
    total: 15,
    abiertas: 5,
    cerradas: 10
  },
  // ... más meses
]
```

**Características**:
- **3 Áreas superpuestas**:
  1. Total OTs (azul - #3b82f6)
  2. OTs Cerradas (índigo - #6366f1)
- **Gradientes con opacidad** (linearGradient)
- **Grid con líneas punteadas** (strokeDasharray: "3 3")
- **Ejes con labels en español**
- **Tooltip personalizado** con estilos
- **Últimos 6 meses** automáticamente

**Cálculo de Datos**:
```javascript
// Agrupa OTs por mes (YYYY-MM)
// Ordena cronológicamente
// Toma últimos 6 meses
// Formatea fecha a "Nov 2025"
```

### 4. Top 5 - Mayor Kilometraje (Bar Chart Horizontal)
**Tipo**: Gráfico de Barras Horizontal
**Librería**: Recharts - BarChart

**Datos**:
```javascript
[
  { name: 'PVHC001', km: 78000 },
  { name: 'PVHC002', km: 65000 },
  // ... top 5
]
```

**Características**:
- **Layout vertical** (barras horizontales)
- **Barras con radio redondeado** ([0, 8, 8, 0])
- **Colores degradados** por posición (HSL)
- **Ancho de eje Y**: 80px para códigos
- **Tooltip formateado**: "78,000 KM"
- **Ordenamiento**: Mayor a menor kilometraje

**Cálculo**:
```javascript
[...fleet]
  .sort((a, b) => b.mileage - a.mileage)
  .slice(0, 5)
```

### 5. Cumplimiento de Rango de Ejecución (Donut Chart) - NUEVO
**Tipo**: Gráfico de Dona (Pie Chart con innerRadius)
**Librería**: Recharts - PieChart

**Datos**:
```javascript
[
  { name: 'En Rango (±10%)', value: X, color: '#10b981' },
  { name: 'Fuera de Rango', value: Y, color: '#ef4444' }
]
```

**Características**:
- Radio interno: 60px
- Radio externo: 100px
- Visualiza vehículos que ejecutan mantenimiento dentro del rango ±10%
- Colores: Verde (cumple) y Rojo (no cumple)
- Nota explicativa: "Los vehículos deben ejecutar mantenimiento entre -10% y +10% del kilometraje programado"

**Importancia**:
- Indica calidad de la programación de mantenimientos
- Mide adherencia a estándares de gestión
- Identifica desviaciones en la ejecución

### 6. Efectividad por Taller (Bar Chart) - NUEVO
**Tipo**: Gráfico de Barras Múltiples
**Librería**: Recharts - BarChart

**Datos**:
```javascript
[
  { 
    name: 'EL HATO',
    total: 15,
    cerradas: 12,
    abiertas: 3,
    efectividad: 80.0
  },
  // ... otros talleres
]
```

**Características**:
- **3 Barras por taller**:
  1. OTs Cerradas (verde - #10b981)
  2. OTs Abiertas (ámbar - #f59e0b)
  3. % Efectividad (azul - #3b82f6)
- **Eje X rotado** (-15°) para mejor legibilidad
- **Labels personalizados**: Nombres sin "TALLER"
- **Tooltip formateado**: Muestra valores y porcentajes
- **Barras redondeadas**: radius [8, 8, 0, 0]
- **Nota explicativa**: Efectividad = (OTs Cerradas / Total OTs) × 100

**Cálculo por Taller**:
```javascript
workshopOTs = workOrders.filter(ot => ot.workshop === 'TALLER X')
total = workshopOTs.length
closed = workshopOTs.filter(ot => ot.status === 'CERRADA').length
effectiveness = (closed / total) × 100
```

**Valor Estratégico**:
- Compara rendimiento entre talleres
- Identifica cuellos de botella
- Ayuda en decisiones de asignación de recursos
- Permite benchmarking interno

---

## 📋 Cards de Estadísticas Resumidas (4 Stats)

### 1. Tasa de Operatividad
- **Valor**: Porcentaje de vehículos operativos
- **Color**: Azul
- **Ícono**: CheckCircle
- **Border**: Izquierdo azul (4px)

### 2. Tasa de Cierre OTs
- **Valor**: Porcentaje de OTs cerradas
- **Color**: Verde
- **Ícono**: Activity
- **Border**: Izquierdo verde (4px)

### 3. Cumplimiento de Rango (NUEVO)
- **Valor**: Porcentaje de vehículos en rango ±10%
- **Color**: Púrpura
- **Ícono**: TrendingUp
- **Border**: Izquierdo púrpura (4px)

### 4. Vehículos en Atención
- **Valor**: Cantidad en mantenimiento
- **Color**: Ámbar
- **Ícono**: Wrench
- **Border**: Izquierdo ámbar (4px)

---

## 🎨 Diseño y Estilos

### Paleta de Colores
```css
/* Estados */
Operativo:     #10b981 (verde)
Mantenimiento: #f59e0b (ámbar)
Fuera Servicio: #ef4444 (rojo)

/* KPI Cards */
Azul:   from-blue-500 to-blue-600
Verde:  from-green-500 to-green-600
Rojo:   from-red-500 to-red-600
Ámbar:  from-amber-500 to-amber-600

/* Gráficos */
Azul principal: #3b82f6
Índigo: #6366f1
```

### Layout Responsivo
```jsx
// Grid de KPIs
grid-cols-1 md:grid-cols-2 lg:grid-cols-4

// Grid de Gráficos
grid-cols-1 lg:grid-cols-2

// Grid de Stats
grid-cols-1 md:grid-cols-3
```

### Sombras y Efectos
- **Cards**: `shadow-lg` con bordes redondeados (`rounded-xl`)
- **Gráficos**: Fondo blanco con `shadow-lg`
- **Gradientes**: Degradados suaves en KPIs
- **Hover**: No implementado en gráficos (interactividad nativa de Recharts)

---

## 🔧 Funciones Auxiliares Utilizadas

### `getNextRoutine(mileage, model)`
**Ubicación**: Heredada de componentes existentes
**Propósito**: Determina la próxima rutina de mantenimiento

**Retorna**:
```javascript
{
  km: Number,        // KM de la próxima rutina
  name: String,      // Nombre de la rutina
  items: Array,      // Items del mantenimiento
  supplies: Array    // Insumos requeridos
}
```

### `useMemo()` para Optimización
Todas las métricas y datos de gráficos usan `useMemo` para evitar recálculos innecesarios:

```javascript
const metrics = useMemo(() => {
  // Cálculos de métricas
}, [fleet, workOrders]);

const otsByMonth = useMemo(() => {
  // Procesamiento de datos por mes
}, [workOrders]);
```

---

## 🚀 Características Técnicas

### Rendimiento
- **Memoización**: Uso extensivo de `useMemo`
- **Responsive Charts**: `ResponsiveContainer` para adaptabilidad
- **Lazy Loading**: Datos calculados solo cuando cambian las dependencias

### Interactividad
- **Tooltips**: Información detallada al hover
- **Legends**: Identificación de series en gráficos
- **Formato de números**: `.toLocaleString()` para separadores de miles

### Accesibilidad
- **Alt texts**: En iconos (lucide-react)
- **Color contrast**: Paleta con buen contraste
- **Responsive**: Adaptable a móviles y tablets

---

## 📱 Navegación

### Sidebar Entry
```jsx
<button onClick={() => setCurrentView('dashboard')}>
  <LayoutDashboard /> Dashboard
</button>
```

### Routing
```javascript
case 'dashboard': return <Dashboard 
  fleet={fleet} 
  workOrders={workOrders} 
  variableHistory={variableHistory} 
/>;
```

### Vista por Defecto
El Dashboard es la vista inicial al cargar la aplicación:
```javascript
const [currentView, setCurrentView] = useState('dashboard');
```

---

## 🔄 Actualización de Datos

### Tiempo Real
Los gráficos se actualizan automáticamente cuando:
1. Se modifica la flota (agregar/editar/eliminar vehículos)
2. Se crean/cierran órdenes de trabajo
3. Se importan datos masivos

### Persistencia
Los datos provienen del estado global que se sincroniza con `localStorage`:
```javascript
useEffect(() => {
  localStorage.setItem('fleet_data', JSON.stringify(fleet));
}, [fleet]);
```

---

## 🐛 Debugging y Mantenimiento

### Verificar Datos
```javascript
console.log('Fleet:', fleet.length);
console.log('Work Orders:', workOrders.length);
console.log('Metrics:', metrics);
```

### Agregar Nueva Métrica
1. Calcular en el hook `useMemo` de `metrics`
2. Agregar KPI Card o actualizar gráfico
3. Actualizar dependencias del `useMemo`

### Agregar Nuevo Gráfico
```javascript
// 1. Preparar datos
const newChartData = useMemo(() => {
  // Procesamiento
}, [dependencies]);

// 2. Agregar en JSX
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={newChartData}>
    {/* Configuración */}
  </BarChart>
</ResponsiveContainer>
```

---

## 📦 Dependencias

### Recharts
```bash
npm install recharts
```

**Componentes Utilizados**:
- `LineChart`, `Line`
- `BarChart`, `Bar`
- `PieChart`, `Pie`, `Cell`
- `AreaChart`, `Area`
- `XAxis`, `YAxis`
- `CartesianGrid`
- `Tooltip`, `Legend`
- `ResponsiveContainer`

### Lucide React (ya instalado)
**Iconos Utilizados**:
- `LayoutDashboard`
- `Car`
- `ClipboardList`
- `AlertTriangle`
- `Clock`
- `PieChart`
- `BarChart3`
- `Activity`
- `TrendingUp`
- `CheckCircle`
- `Wrench`

---

## 🎯 Casos de Uso

### 1. Monitoreo Diario
- **Usuario**: Supervisor de flota
- **Acción**: Ver KPIs de operatividad al iniciar sesión
- **Beneficio**: Visión rápida del estado general

### 2. Análisis de Tendencias
- **Usuario**: Gerente de mantenimiento
- **Acción**: Revisar gráfico de OTs por mes
- **Beneficio**: Identificar patrones y planificar recursos

### 3. Priorización de Mantenimientos
- **Usuario**: Coordinador de taller
- **Acción**: Ver "Mantenimientos Vencidos" y "Próximos"
- **Beneficio**: Priorizar vehículos críticos

### 4. Análisis de Kilometraje
- **Usuario**: Analista de costos
- **Acción**: Revisar Top 5 de mayor kilometraje
- **Beneficio**: Identificar vehículos para renovación

---

## 🔮 Mejoras Futuras

### Sugerencias de Implementación

1. **Filtros de Fecha**
   - Selector de rango de fechas
   - Vista de diferentes periodos

2. **Exportar Datos**
   - Descargar PDF del dashboard
   - Exportar gráficos como imágenes

3. **Alertas Personalizadas**
   - Notificaciones push
   - Umbrales configurables

4. **Gráficos Adicionales**
   - Costos por mantenimiento
   - Downtime por vehículo
   - Distribución geográfica

5. **Comparativas**
   - Mes actual vs mes anterior
   - Año actual vs año anterior

6. **Drill-down**
   - Click en gráfico → Ver detalle
   - Navegación contextual

---

## 📊 Métricas de Éxito

### KPIs del Dashboard
- **Tiempo de carga**: < 1 segundo
- **Actualización**: Tiempo real
- **Usabilidad**: 3 clicks para cualquier información
- **Responsividad**: 100% en móvil/tablet/desktop

---

**Desarrollador**: Juan Felipe Granados  
**Fecha**: Diciembre 2025  
**Versión**: 0.1  
**Módulo**: Dashboard de Gestión de Mantenimiento
