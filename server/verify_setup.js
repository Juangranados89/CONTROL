// Script de verificación rápida del sistema de importación
// Verifica que todos los componentes estén en su lugar

import fs from 'fs';
import path from 'path';

console.log('🔍 Verificando sistema de importación de activos...\n');

const checks = [];

// 1. Verificar schema.prisma
const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const hasNewFields = 
    schema.includes('familiaTipologia') &&
    schema.includes('serieChasis') &&
    schema.includes('anioModelo');
  
  checks.push({
    name: 'Schema Prisma actualizado',
    status: hasNewFields ? '✅' : '❌',
    detail: hasNewFields ? 'Todos los campos presentes' : 'Faltan campos nuevos'
  });
} else {
  checks.push({
    name: 'Schema Prisma',
    status: '❌',
    detail: 'Archivo no encontrado'
  });
}

// 2. Verificar migración
const migrationDir = path.join(process.cwd(), 'prisma', 'migrations', '20241216_add_asset_fields');
const migrationExists = fs.existsSync(migrationDir);
checks.push({
  name: 'Migración de BD',
  status: migrationExists ? '✅' : '⚠️',
  detail: migrationExists ? 'migration.sql creado' : 'Aplicar manualmente si es necesario'
});

// 3. Verificar API
const apiPath = path.join(process.cwd(), 'src', 'api.js');
if (fs.existsSync(apiPath)) {
  const api = fs.readFileSync(apiPath, 'utf-8');
  const hasFiltering = api.includes('esCamioneta') && api.includes('esPropio');
  
  checks.push({
    name: 'API con filtrado resiliente',
    status: hasFiltering ? '✅' : '❌',
    detail: hasFiltering ? 'Lógica de filtrado implementada' : 'Falta lógica de filtrado'
  });
} else {
  checks.push({
    name: 'API',
    status: '❌',
    detail: 'Archivo api.js no encontrado'
  });
}

// 4. Verificar script de importación
const importScript = path.join(process.cwd(), 'import_assets.js');
checks.push({
  name: 'Script de importación CSV',
  status: fs.existsSync(importScript) ? '✅' : '❌',
  detail: fs.existsSync(importScript) ? 'import_assets.js disponible' : 'Script no encontrado'
});

// 5. Verificar archivo de ejemplo
const csvExample = path.join(process.cwd(), 'activos_ejemplo.csv');
checks.push({
  name: 'Archivo CSV de ejemplo',
  status: fs.existsSync(csvExample) ? '✅' : '⚠️',
  detail: fs.existsSync(csvExample) ? 'activos_ejemplo.csv disponible' : 'Crear uno para testing'
});

// 6. Verificar documentación
const docs = [
  path.join(process.cwd(), '..', 'PLANTILLA_IMPORTACION_ACTIVOS.md'),
  path.join(process.cwd(), 'README.md'),
  path.join(process.cwd(), '..', 'RESUMEN_IMPLEMENTACION_ACTIVOS.md')
];

const docsExist = docs.filter(d => fs.existsSync(d)).length;
checks.push({
  name: 'Documentación',
  status: docsExist >= 2 ? '✅' : '⚠️',
  detail: `${docsExist}/3 archivos de docs encontrados`
});

// Mostrar resultados
console.log('📋 RESULTADOS DE VERIFICACIÓN:\n');
checks.forEach(check => {
  console.log(`${check.status} ${check.name}`);
  console.log(`   ${check.detail}\n`);
});

// Resumen
const passed = checks.filter(c => c.status === '✅').length;
const total = checks.length;

console.log('─'.repeat(50));
console.log(`\n📊 Resumen: ${passed}/${total} checks pasados\n`);

if (passed === total) {
  console.log('🎉 ¡Sistema listo para usar!\n');
  console.log('Siguiente paso:');
  console.log('  1. npx prisma generate');
  console.log('  2. node import_assets.js activos_ejemplo.csv\n');
} else if (passed >= total - 1) {
  console.log('⚠️  Casi listo. Revisar items marcados con ❌\n');
} else {
  console.log('❌ Sistema incompleto. Revisar checks fallidos.\n');
}

console.log('Ver documentación completa en:');
console.log('  - ../PLANTILLA_IMPORTACION_ACTIVOS.md');
console.log('  - ../RESUMEN_IMPLEMENTACION_ACTIVOS.md');
console.log('  - README.md\n');
