// Script de ejemplo para importar activos desde CSV
// Uso: node import_assets.js archivo.csv

import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Leer archivo CSV
const csvFile = process.argv[2] || 'activos.csv';

if (!fs.existsSync(csvFile)) {
  console.error(`❌ Archivo no encontrado: ${csvFile}`);
  process.exit(1);
}

const csvContent = fs.readFileSync(csvFile, 'utf-8');

// Parsear CSV (separador por punto y coma)
const records = parse(csvContent, {
  columns: true,
  delimiter: ';',
  skip_empty_lines: true,
  trim: true
});

console.log(`📄 Archivo: ${csvFile}`);
console.log(`📊 Registros encontrados: ${records.length}`);

// Mapear columnas a formato API
const vehicles = records.map(row => ({
  code: row['CODIGO DEL EQUIPO'],
  plate: row['PLACA'],
  familiaTipologia: row['FAMILIA/TIPOLOGÍA'] || row['FAMILIA/TIPOLOGIA'],
  descripcion: row['DESCRIPCIÓN'] || row['DESCRIPCION'],
  brand: row['MARCA'],
  model: row['MODELO / LINEA'] || row['MODELO'],
  serieChasis: row['SERIE CHASIS / VIN'] || row['VIN'],
  serieMotor: row['SERIE MOTOR'],
  anioModelo: row['AÑO MODELO'] || row['ANO MODELO'],
  estadoActual: row['ESTADO ACTUAL'],
  ubicacionFrente: row['UBICACIÓN O FRENTE DE OBRA'] || row['UBICACION'],
  owner: 'PROPIO',  // Asume PROPIO por defecto
  mileage: 0,
  vin: row['SERIE CHASIS / VIN'] || row['VIN'],
  area: row['UBICACIÓN O FRENTE DE OBRA'] || row['UBICACION']
}));

console.log('\n📋 Primeros 3 registros mapeados:');
console.log(JSON.stringify(vehicles.slice(0, 3), null, 2));

// Enviar al servidor
const API_URL = process.env.API_URL || 'http://localhost:3001/api';

console.log(`\n🚀 Enviando ${vehicles.length} registros a ${API_URL}/vehicles/bulk...`);

fetch(`${API_URL}/vehicles/bulk`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(vehicles)
})
  .then(res => res.json())
  .then(result => {
    console.log('\n✅ Resultado de la importación:');
    console.log(`   Total procesados: ${result.summary.total}`);
    console.log(`   ✅ Importados: ${result.summary.imported}`);
    console.log(`   ⚠️  Filtrados: ${result.summary.filteredOut}`);
    console.log(`   ❌ Fallidos: ${result.summary.failed}`);
    
    if (result.filteredRecords && result.filteredRecords.length > 0) {
      console.log('\n⚠️  Registros filtrados (no cumplen criterios):');
      result.filteredRecords.forEach(f => {
        console.log(`   - ${f.code} (${f.plate}): ${f.reason}`);
      });
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Errores:');
      result.errors.forEach(e => {
        console.log(`   - ${e.record?.code || 'N/A'}: ${e.error}`);
      });
    }
    
    console.log('\n🎉 Importación completada!');
  })
  .catch(error => {
    console.error('\n❌ Error al importar:', error.message);
    process.exit(1);
  });
