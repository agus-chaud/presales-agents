/**
 * Script de seed: actualiza el perfil de IQ4b en Firestore con los campos extendidos.
 * Preserva los campos existentes y agrega/sobreescribe solo los 4 nuevos.
 * Uso: npx tsx --env-file=.env scripts/seed-profile.ts
 */

import { initFirestore } from '../src/db/firestore.js';
import { companyProfileRepo } from '../src/db/repositories/companyProfileRepo.js';

const CAMPOS_EXTENDIDOS = {
  servicios:
    'Implementación Qlik Sense Enterprise (on-premise y cloud), Qlik Cloud (SaaS), QlikView, NPrinting (reportería automática programada), GeoAnalytics, diseño y desarrollo de dashboards estratégicos, migración de QlikView a Qlik Sense, capacitación y coaching en analytics, consultoría de transformación analítica, soporte y mantenimiento. Modelo comercial: paquetes de horas mensuales.',

  herramientas_qlik:
    'Qlik Sense Enterprise, Qlik Cloud (SaaS), QlikView, Qlik NPrinting, Qlik Alerting, Qlik GeoAnalytics, Qlik Insight Advisor (IA augmentada), Qlik AutoML / Predict, Qlik Replicate (CDC), Qlik Talend (integración de datos), Qlik Automate (workflows). Conectores principales: SAP, Salesforce, SQL Server, Oracle, MySQL, PostgreSQL, Snowflake, Azure, AWS.',

  clientes_referencia:
    'Western Union (finanzas/pagos — solución de seguridad operacional y tracking geográfico), ' +
    'Correo Argentino (logística — implementación Qlik con automatizaciones), ' +
    'Banco Supervielle (finanzas — transformación de RRHH data-driven), ' +
    'Efectivo Si (finanzas — gobierno de datos), ' +
    'Latin Securities (finanzas/mercado de capitales), ' +
    'Brinks (seguridad y transporte de valores), ' +
    'Landmark (retail/supply chain — automatización de dashboards de stock), ' +
    'Norauto Argentina (retail/automotriz — analytics comercial), ' +
    'Don Carmelo (manufactura de alimentos — enlatados y empanadas), ' +
    'Grupo Guazzaroni Greco (agro — agroquímicos, fertilizantes, servicios agronómicos, semillas), ' +
    'Stylus (distribución mayorista de tecnología), ' +
    'Pindo SA (agroindustria — yerba mate y madera), ' +
    'ESET LATAM (tecnología/ciberseguridad — coaching BI avanzado), ' +
    'Innovamed (salud — optimización de procesos analíticos), ' +
    'BPN (servicios — coaching NPrinting).',

  senales_de_compra:
    'Empresa usa Excel o Access para reportes críticos, tienen datos en silos sin visibilidad unificada, ' +
    'acaban de implementar un ERP (SAP, Oracle, etc.) y necesitan analytics encima, ' +
    'tienen QlikView antiguo y quieren migrar a Qlik Sense o Qlik Cloud, ' +
    'su proceso de reporting es manual y lento, ' +
    'tienen equipo de IT pero sin expertise en BI/analytics, ' +
    'buscan certificaciones o partners Qlik en Argentina, ' +
    'están creciendo y necesitan escalar su inteligencia de negocio.',
};

const PERFIL_BASE = {
  nombre: 'IQ4b',
  descripcion:
    'Consultora especializada en Business Intelligence y Analytics. Platinum Partner oficial de Qlik en Argentina. ' +
    'Transformamos empresas a través de la analítica de datos, combinando tecnología Qlik con consultoría de negocio.',
  propuesta_de_valor:
    'Somos el partner Qlik más experimentado de Argentina. Implementamos soluciones de analytics que permiten a las empresas ' +
    'tomar decisiones basadas en datos en tiempo real. "The Associative Advantage": el motor asociativo de Qlik permite ' +
    'explorar datos libremente y descubrir insights que otras herramientas no muestran. ' +
    'Modelo flexible de paquetes de horas mensuales adaptado a cada empresa.',
  clientes_ideales:
    'PyMEs y empresas medianas a grandes en Argentina y LATAM que necesitan implementar o mejorar su inteligencia de negocio. ' +
    'Industrias: finanzas, retail, logística, manufactura, agro, tecnología, salud. ' +
    'Decisores: CIO, IT Manager, Gerente de BI/Analytics, CFO, Gerente Comercial.',
  casos_de_exito:
    'Implementación de solución de seguridad operacional y tracking geográfico para Western Union. ' +
    'Transformación data-driven de RRHH en Banco Supervielle. ' +
    'Automatización de reportes con Qlik en Correo Argentino. ' +
    'Coaching BI avanzado para ESET LATAM. ' +
    'Analytics comercial "Norauto Analytics" para Norauto Argentina.',
  diferenciadores:
    'Platinum Partner oficial de Qlik — el nivel más alto de certificación en Argentina. ' +
    'Equipo certificado con más de 10 años de experiencia en implementaciones Qlik. ' +
    'Guillermo Blauzwirn reconocido como principal mentor de Qlik en Argentina. ' +
    'Modelo comercial flexible: paquetes de horas mensuales sin compromisos de largo plazo. ' +
    'Acompañamiento end-to-end: desde la arquitectura hasta la adopción del usuario.',
};

async function main() {
  initFirestore();

  const existing = await companyProfileRepo.get();

  if (existing) {
    console.log('✅ Perfil existente encontrado:', existing.nombre);
    console.log('⏳ Actualizando con campos extendidos (preservando campos base)...');
    await companyProfileRepo.save({ ...existing, ...CAMPOS_EXTENDIDOS });
  } else {
    console.log('⚠️  No existe perfil. Creando perfil completo desde cero...');
    await companyProfileRepo.save({ ...PERFIL_BASE, ...CAMPOS_EXTENDIDOS });
  }

  console.log('🎉 Perfil guardado exitosamente con todos los campos:');
  console.log('   Campos base: nombre, descripcion, propuesta_de_valor, clientes_ideales, casos_de_exito, diferenciadores ✓');
  console.log('   Campos extendidos:');
  console.log('   - servicios ✓');
  console.log('   - herramientas_qlik ✓');
  console.log('   - clientes_referencia ✓ (15 clientes)');
  console.log('   - senales_de_compra ✓');
  console.log('\n💡 Podés refinar cualquier campo corriendo /perfil en Telegram.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
