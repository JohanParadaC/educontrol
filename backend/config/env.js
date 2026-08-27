// config/env.js
// ---------------------------------------------------------------------------
// Comprobación de variables de entorno al arrancar.
//
// Sin esto, un clone sin .env arranca "bien" y luego devuelve 500 en cada login
// (jwt.sign lanza si el secreto es undefined). Es peor que fallar: el síntoma
// aparece lejos de la causa. Aquí se decide una vez, al principio:
//   - en producción faltar un secreto es fatal → salimos con un mensaje claro,
//   - en desarrollo rellenamos con valores obvios y avisamos.
// ---------------------------------------------------------------------------

const jwt = require('jsonwebtoken');
const { DURACION_POR_DEFECTO } = require('../utils/jwt');

const DEV_JWT_SECRET = 'dev-only-no-usar-en-produccion';
const DEV_PROFESOR_CLAVE = 'profesor-dev';

/**
 * Longitud mínima del secreto en producción.
 *
 * Que exista no basta: `JWT_SECRET=x` pasaba la comprobación y firmaba tokens
 * que se rompen a martillazos. 32 caracteres es el tamaño del hash de HS256,
 * así que por debajo de eso el secreto es más corto que la firma que produce.
 */
const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Por qué NO sirve este secreto en producción, o `null` si sirve.
 *
 * El de desarrollo se rechaza por su nombre y no solo por su longitud: está
 * escrito en este repositorio y en los .env.example, así que quien lo copie al
 * servidor tendrá un secreto público. Que además sea corto es una casualidad
 * que no conviene que sostenga la regla.
 */
function motivoSecretoInaceptable(secreto) {
  if (secreto === DEV_JWT_SECRET) {
    return 'es el secreto de desarrollo, que está escrito en el repositorio';
  }
  if (secreto.length < LONGITUD_MINIMA_SECRETO) {
    return `tiene ${secreto.length} caracteres y hacen falta ${LONGITUD_MINIMA_SECRETO}`;
  }
  return null;
}

/**
 * ¿Sirve JWT_EXPIRES_IN?
 *
 * Se comprueba FIRMANDO un token de prueba, no con una expresión regular. La
 * gramática de `ms` tiene más recovecos de los que parece —'12 h' vale, '12
 * horas' no— y un validador escrito a mano acabaría discrepando de lo que hace
 * el código de verdad, que es lo peor que puede hacer un validador: dar por
 * bueno lo que luego revienta, o al revés.
 *
 * Además se mira que el token nazca con vida: `expiresIn: '0'` es un valor que
 * `jwt.sign` acepta sin protestar y que caduca en el mismo instante en que se
 * firma, así que cada login devolvería un token ya vencido.
 */
function motivoDuracionInaceptable(valor) {
  let token;
  try {
    token = jwt.sign({ sonda: true }, process.env.JWT_SECRET, { expiresIn: valor });
  } catch {
    return 'no es una duración válida: usa el formato de jsonwebtoken (12h, 30m, 7d) o un número de segundos';
  }

  const { iat, exp } = jwt.decode(token);
  return exp > iat
    ? null
    : 'caduca en el mismo instante en que se firma: cada sesión nacería vencida';
}

/**
 * Valida JWT_EXPIRES_IN. Devuelve false si ha matado el proceso.
 *
 * No se validaba en absoluto, y está documentada en el docker-compose.yml.
 * `utils/jwt.js` se la pasa tal cual a `jwt.sign`, así que un `12 horas` no
 * rompe el arranque: rompe el primer login, con un 500 y sin ninguna pista de
 * por qué. Que es justo lo que este fichero existe para evitar.
 */
function verificarDuracionDelToken(esProduccion) {
  const crudo = process.env.JWT_EXPIRES_IN;
  if (!crudo) return true;

  const motivo = motivoDuracionInaceptable(crudo);
  if (!motivo) return true;

  if (esProduccion) {
    console.error(`❌ JWT_EXPIRES_IN="${crudo}" ${motivo}.`);
    process.exit(1);
    return false;
  }

  console.warn(`⚠️  JWT_EXPIRES_IN="${crudo}" ${motivo}. Se usa ${DURACION_POR_DEFECTO}.`);
  process.env.JWT_EXPIRES_IN = DURACION_POR_DEFECTO;
  return true;
}

/**
 * Cuántos proxies hay delante, para `app.set('trust proxy', n)`.
 *
 * Un NÚMERO de saltos y nunca `true`: con `true`, Express se cree la cabecera
 * `X-Forwarded-For` entera, así que cualquiera puede inventarse su IP
 * mandándola él mismo — y con ella se saltaría el freno del login, que es
 * justo lo que ese freno viene a impedir. Con un número, solo se descartan los
 * `n` últimos saltos, que son los que ponen proxies que controlamos nosotros.
 *
 * Se valida aquí, con el resto del entorno, por lo mismo que lo demás: un
 * `TRUST_PROXY=sí` mal escrito no debe aparecer como un fallo raro del
 * limitador tres capas más abajo.
 */
function saltosDeProxy() {
  const crudo = process.env.TRUST_PROXY;
  if (crudo === undefined || crudo === '') return 0;

  const saltos = Number(crudo);
  if (!Number.isInteger(saltos) || saltos < 0) {
    console.warn(
      `⚠️  TRUST_PROXY="${crudo}" no es un número entero de saltos: se usa 0 (sin proxy).`
    );
    return 0;
  }
  return saltos;
}

function verificarEntorno() {
  const esProduccion = process.env.NODE_ENV === 'production';

  if (!process.env.JWT_SECRET) {
    if (esProduccion) {
      console.error('❌ Falta JWT_SECRET. Configúralo antes de arrancar en producción.');
      process.exit(1);
      // `return` explícito: sin él, la asignación de abajo dependería de que
      // process.exit mate el proceso de inmediato para no colar el secreto de
      // desarrollo en producción. Eso es apoyarse en un efecto colateral.
      return;
    }
    process.env.JWT_SECRET = DEV_JWT_SECRET;
    console.warn('⚠️  JWT_SECRET no configurado: usando un secreto de desarrollo.');
  } else if (esProduccion) {
    // Que la variable esté puesta no dice nada de lo que vale.
    const motivo = motivoSecretoInaceptable(process.env.JWT_SECRET);
    if (motivo) {
      console.error(`❌ JWT_SECRET no sirve para producción: ${motivo}.`);
      console.error(
        `   Genera uno con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
      );
      process.exit(1);
      return;
    }
  }

  if (!verificarDuracionDelToken(esProduccion)) return;

  if (!process.env.PROFESOR_CLAVE) {
    if (esProduccion) {
      console.warn(
        '⚠️  PROFESOR_CLAVE no configurada: nadie podrá ascender a profesor sin un admin.'
      );
    } else {
      process.env.PROFESOR_CLAVE = DEV_PROFESOR_CLAVE;
      console.warn(
        `⚠️  PROFESOR_CLAVE no configurada: usando "${DEV_PROFESOR_CLAVE}" en desarrollo.`
      );
    }
  }
}

module.exports = { verificarEntorno, saltosDeProxy };
