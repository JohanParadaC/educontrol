// config/seed.js
// ---------------------------------------------------------------------------
// Sembrado del administrador inicial.
//
// Vivía dentro de app.js, que por eso importaba bcrypt y un modelo de Mongoose
// solo para esto. Un fichero que monta rutas de Express no tiene por qué saber
// cómo se hashea una contraseña.
// ---------------------------------------------------------------------------
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { normalizarCorreo } = require('../utils/correo');

/**
 * Crea el administrador inicial si no existe. Idempotente.
 * En producción exige ADMIN_PASSWORD: una contraseña por defecto conocida en un
 * repositorio público equivale a no tener contraseña.
 */
async function ensureAdminSeed() {
  try {
    // ADMIN_EMAIL lo escribe una persona en un .env o en el compose, y ahí
    // caben mayúsculas y un espacio de sobra al copiar. Era el único de los
    // cinco sitios que buscan por correo sin pasar por la regla común.
    //
    // Que hoy funcione es de rebote: el esquema declara lowercase y trim, y
    // Mongoose aplica esos setters también al filtro de la consulta. Es decir,
    // la idempotencia de este seed depende de un detalle del ORM y no de una
    // decisión de este código. El día que el campo pierda el lowercase, o que
    // esta consulta pase por el driver en crudo, se crea un segundo admin —o
    // revienta contra el índice único— y nadie relacionará las dos cosas.
    const correo = normalizarCorreo(process.env.ADMIN_EMAIL || 'admin@educontrol.com');
    const plainPassword = process.env.ADMIN_PASSWORD || 'Admin123*';

    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
      // Sin ADMIN_PASSWORD no se siembra. Ahora bien: si además NO HAY ningún
      // administrador en la base, lo que queda es un despliegue que arranca
      // sano, se marca `healthy` y no tiene ninguna puerta por la que entrar —
      // el registro público solo crea estudiante o profesor, y
      // /api/admin/seed-admin es 404 en producción—.
      //
      // Eso no es un aviso, es un arranque fallido, y así se comporta: un
      // `console.warn` de una línea entre las de arranque normales tiene el
      // mismo aspecto que las de éxito y se pierde en cuanto hay logs
      // agregados. Con administradores ya creados, en cambio, no pasa nada y
      // basta con avisar.
      const admins = await Usuario.countDocuments({ rol: 'admin' });
      if (admins > 0) {
        console.warn('⚠️  ADMIN_PASSWORD no configurada: se omite el seed del admin.');
        return;
      }

      console.error(
        [
          '',
          '❌ ══════════════════════════════════════════════════════════════════',
          '❌  DESPLIEGUE SIN ADMINISTRADOR: no hay forma de entrar.',
          '❌',
          '❌  ADMIN_PASSWORD está vacía y la base no tiene ningún admin, así',
          '❌  que no se ha sembrado ninguno. El registro público solo crea',
          '❌  estudiante o profesor, y /api/admin/seed-admin no existe en',
          '❌  producción: nadie podría administrar esta instalación.',
          '❌',
          '❌  Configura ADMIN_PASSWORD y vuelve a arrancar.',
          '❌ ══════════════════════════════════════════════════════════════════',
          '',
        ].join('\n')
      );
      throw Object.assign(
        new Error('ADMIN_PASSWORD no configurada y no hay ningún administrador'),
        {
          arranqueImposible: true,
        }
      );
    }

    const exists = await Usuario.findOne({ correo }).lean();
    if (exists) {
      console.log(`ℹ️  Admin ya existe: ${correo}`);
      return;
    }

    const hash = await bcrypt.hash(plainPassword, 10);
    await Usuario.create({
      nombre: 'Admin',
      correo,
      ['contraseña']: hash, // el campo del schema lleva tilde
      rol: 'admin',
    });

    console.log(`✅ Admin creado: ${correo}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`   contraseña: ${plainPassword}`);
    }
  } catch (err) {
    // Un fallo escribiendo el admin no debe tumbar el arranque: la aplicación
    // sirve igual y el problema se ve en el log. La excepción es el despliegue
    // que se queda SIN NINGUNA forma de entrar, que no es un fallo del
    // sembrado sino una configuración que no da un sistema utilizable.
    if (err?.arranqueImposible) throw err;
    console.error('❌ Error creando admin:', err);
  }
}

module.exports = { ensureAdminSeed };
