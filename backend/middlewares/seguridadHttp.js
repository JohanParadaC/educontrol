// middlewares/seguridadHttp.js
// ---------------------------------------------------------------------------
// Cabeceras de seguridad y límites de peticiones.
//
// Antes no había ninguna de las dos cosas: la SPA se podía meter en un iframe
// ajeno (clickjacking) y el login admitía intentos ilimitados.
// ---------------------------------------------------------------------------
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const esTest = () => process.env.NODE_ENV === 'test';
const esProduccion = () => process.env.NODE_ENV === 'production';

/**
 * Cabeceras de seguridad, con una CSP que la SPA de Angular pueda cumplir.
 *
 * `'unsafe-inline'` en style-src no es un descuido: Angular Material escribe
 * estilos en línea en tiempo de ejecución —los overlays, los ripples y las
 * animaciones calculan posiciones y las aplican al elemento— y sin eso la
 * interfaz se ve rota. En script-src no hace falta, y ahí sí queda cerrado.
 *
 * Las fuentes y los iconos están autoalojados (@fontsource y material-icons),
 * así que no hay que abrir ningún dominio externo.
 */
const cabecerasSeguras = () =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // Nadie mete esta aplicación en un iframe.
        frameAncestors: ["'none'"],
      },
    },
    // HSTS solo en producción: en local se sirve por http y una cabecera que
    // obliga a https deja el navegador incapaz de abrir localhost hasta que se
    // limpia a mano.
    hsts: esProduccion(),
    // El frontend se sirve desde este mismo origen, así que no hay recursos
    // cruzados que aislar; con COEP activo, el build de Angular no carga.
    crossOriginEmbedderPolicy: false,
  });

/**
 * Freno al login: 5 intentos fallidos cada 15 minutos.
 *
 * La clave combina IP y correo. Solo por IP, un aula entera detrás del mismo
 * NAT se bloquea entre sí; solo por correo, cualquiera deja fuera a un usuario
 * concreto escribiendo mal su contraseña cinco veces.
 *
 * Los intentos con éxito no cuentan: quien acierta no está haciendo fuerza
 * bruta, y sumarlos rompería a quien inicia sesión desde varios dispositivos.
 */
const limiteLogin = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // ipKeyGenerator normaliza IPv6 (agrupa por /56 en vez de por dirección
    // suelta): sin él, cambiar el último bloque da intentos infinitos.
    keyGenerator: req =>
      `${ipKeyGenerator(req.ip)}:${String(req.body?.correo ?? '').toLowerCase()}`,
    message: {
      ok: false,
      msg: 'Demasiados intentos fallidos. Prueba de nuevo dentro de unos minutos.',
    },
  });

/**
 * Freno general del resto de la API: laxo a propósito.
 *
 * No está para atajar un ataque —para eso está el del login— sino para que un
 * bucle infinito en el cliente o un script suelto no tumben el servidor. 1000
 * peticiones cada 15 minutos es más de una por segundo sostenida: ninguna
 * sesión normal se acerca.
 */
const limiteGeneral = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { ok: false, msg: 'Demasiadas peticiones. Prueba de nuevo dentro de unos minutos.' },
    // La suite lanza cientos de peticiones seguidas desde la misma IP. El
    // límite del login sí sigue activo en test: hay un caso que comprueba el 429.
    skip: esTest,
  });

module.exports = { cabecerasSeguras, limiteLogin, limiteGeneral };
