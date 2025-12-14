# 📦 Guía de Importación de Activos

## 🎯 Objetivo
Actualizar masivamente la base de datos de activos desde Excel o pegando datos copiados.

## 📍 Ubicación
**Admin. Mantenimiento → Administración de Activos → Botón "Importar Datos"**

## 📋 Formatos Soportados

### Columnas Requeridas (mínimo)
- **Codigo**: Código interno del activo (ej: PVHC001)
- **Placa**: Placa del vehículo (ej: H1234-1)
- **Modelo**: Descripción del vehículo (ej: CAMIONETA RAM)

### Columnas Opcionales
- **Año**: Año del vehículo (ej: 2023)
- **Kilometraje**: Kilometraje actual (ej: 45000)
- **Estado**: OPERATIVO / MANTENIMIENTO / FUERA DE SERVICIO
- **Ultimo Mtto**: Kilometraje del último mantenimiento
- **Conductor**: Nombre del conductor asignado
- **VIN**: Número de serie o VIN del vehículo
- **Rutina**: Rutina de mantenimiento asignada (ej: 5000)

## 🔧 Métodos de Importación

### Método 1: Copiar y Pegar desde Excel

1. Abre tu archivo Excel con los datos de activos
2. **Selecciona TODA la tabla** incluyendo encabezados
3. **Copia** (Ctrl+C)
4. En Fleet Pro, click en **"Importar Datos"**
5. **Pega** en el área de texto (Ctrl+V)
6. Click en **"Vista Previa"** para validar
7. Selecciona el modo:
   - **Reemplazar**: Borra toda la BD actual y carga los nuevos datos
   - **Combinar**: Actualiza existentes y agrega nuevos
8. Click en **"Confirmar Importación"**

### Método 2: Cargar Archivo CSV/TXT

1. Exporta tu Excel como **CSV** o **TXT** (delimitado por tabulaciones)
2. En Fleet Pro, click en **"Importar Datos"**
3. Click en **"Cargar desde archivo"**
4. Selecciona tu archivo
5. Click en **"Vista Previa"** para validar
6. Confirma la importación

## 📊 Ejemplo de Datos

```
Codigo	Placa	Modelo	Año	Kilometraje	Estado	Ultimo Mtto	Conductor	VIN	Rutina
PVHC001	H1234-1	CAMIONETA RAM	2023	45000	OPERATIVO	40000	JUAN PEREZ	VIN123456	5000
PVHC002	H5678-2	CAMIONETA JMC	2022	32000	OPERATIVO	30000	MARIA LOPEZ	VIN789012	5000
PVHC003	H9012-3	CAMIONETA RAM	2024	15000	MANTENIMIENTO	10000	PENDIENTE	VIN345678	
```

## ⚠️ Consideraciones Importantes

### ✅ Ventajas
- **Actualización masiva**: Importa cientos de activos en segundos
- **Flexible**: Reconoce múltiples nombres de columnas (español/inglés)
- **Seguro**: Vista previa antes de confirmar
- **Persistente**: Los datos se guardan automáticamente en localStorage
- **Propagación**: Los cambios se reflejan automáticamente en:
  - 📅 Planeación de Mantenimiento
  - 📋 Generación de OTs
  - 👥 Conductores
  - 📊 Variables

### ⚠️ Modos de Importación

#### Modo Reemplazar
- ⚠️ **ELIMINA** toda la base de datos actual
- ✅ Útil para cargar datos completamente nuevos
- ⚠️ Requiere doble confirmación

#### Modo Combinar
- ✅ **Actualiza** activos existentes (por código o placa)
- ✅ **Agrega** nuevos activos que no existan
- ✅ No elimina datos existentes
- ✅ Recomendado para actualizaciones incrementales

### 🔍 Validaciones Automáticas
- Elimina filas vacías
- Convierte códigos y placas a mayúsculas
- Establece valores por defecto para campos vacíos
- Valida que código y placa sean únicos

## 🏗️ Arquitectura Técnica

### Flujo de Datos
```
Excel/CSV → Importación → Validación → localStorage → Estado React → Todos los Módulos
```

### Componentes Afectados
1. **AssetManager**: Gestión de activos (CRUD + Importación)
2. **PlanningView**: Usa fleet actualizado para planeación
3. **WorkOrders**: Genera OTs con datos actualizados
4. **DriversView**: Lista conductores actualizados
5. **DataLoadView**: Carga variables sobre fleet actualizado

### Persistencia
- Los datos se guardan en **localStorage** como `fleet_data`
- Cada cambio en el estado `fleet` actualiza automáticamente localStorage
- Los datos persisten entre sesiones del navegador

## 🐛 Troubleshooting

### Problema: "No hay datos válidos para importar"
- **Causa**: Formato incorrecto o datos vacíos
- **Solución**: Verifica que hayas copiado los encabezados y al menos una fila de datos

### Problema: Los datos no se reflejan en Planeación
- **Causa**: Caché del navegador
- **Solución**: Recarga la página (F5) o cierra y abre la pestaña

### Problema: Algunos campos aparecen vacíos
- **Causa**: Nombres de columnas no reconocidos
- **Solución**: Usa los nombres recomendados en la sección "Columnas"

### Problema: Duplicados después de importar
- **Causa**: Usaste modo "Combinar" con códigos/placas diferentes
- **Solución**: Usa modo "Reemplazar" o asegura códigos únicos

## 📞 Soporte
Desarrollador: Juan Felipe Granados  
Versión: 0.1  
Año: 2025
