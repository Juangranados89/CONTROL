import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { INITIAL_FLEET } from '../../src/data.js';

dotenv.config();

const prisma = new PrismaClient();

async function seedFleet() {
  console.log('🌱 Iniciando seed de flota...');

  const fleet = Array.isArray(INITIAL_FLEET) ? INITIAL_FLEET : [];

  if (fleet.length === 0) {
    console.error('❌ INITIAL_FLEET está vacío o no es válido');
    return;
  }

  console.log(`📦 Cargando ${fleet.length} vehículos...`);
  
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const vehicle of fleet) {
    try {
      // Verificar si el vehículo ya existe
      const existing = await prisma.vehicle.findFirst({
        where: {
          OR: [
            { code: vehicle.code },
            { plate: vehicle.plate }
          ]
        }
      });
      
      const vehicleData = {
        code: vehicle.code,
        plate: vehicle.plate,
        model: vehicle.model || 'N/A',
        brand: vehicle.brand || null,
        owner: vehicle.owner || null,
        mileage: vehicle.mileage || 0,
        lastMaintenance: vehicle.lastMaintenance || null,
        lastMaintenanceDate: vehicle.lastMaintenanceDate || null,
        vin: vehicle.vin || vehicle.serieChasis || null,
        area: vehicle.area || null,
        familiaTipologia: vehicle.familiaTipologia || null,
        descripcion: vehicle.descripcion || null,
        serieChasis: vehicle.serieChasis || vehicle.vin || null,
        serieMotor: vehicle.serieMotor || null,
        anioModelo: vehicle.year ? String(vehicle.year) : vehicle.anioModelo || null,
        estadoActual: vehicle.status || vehicle.estadoActual || 'OPERATIVO',
        ubicacionFrente: vehicle.ubicacionFrente || null
      };
      
      if (existing) {
        // Actualizar solo si los datos son diferentes
        await prisma.vehicle.update({
          where: { id: existing.id },
          data: vehicleData
        });
        updated++;
        console.log(`✅ Actualizado: ${vehicle.code} - ${vehicle.plate}`);
      } else {
        // Crear nuevo vehículo
        await prisma.vehicle.create({
          data: vehicleData
        });
        created++;
        console.log(`✨ Creado: ${vehicle.code} - ${vehicle.plate}`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error procesando ${vehicle.code}:`, error.message);
    }
  }
  
  console.log('\n📊 Resumen:');
  console.log(`   ✨ Creados: ${created}`);
  console.log(`   ✅ Actualizados: ${updated}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log(`   📦 Total procesados: ${fleet.length}`);
}

async function main() {
  try {
    await seedFleet();
    console.log('\n✅ Seed completado exitosamente');
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
