// __tests__/seguridad.cambio-password.spec.js
// ---------------------------------------------------------------------------
// Cambiar la propia contraseña exige la actual (reautenticación).
//
// Sin esto, una sesión abierta un minuto en un ordenador ajeno bastaba para
// quedarse la cuenta: el token era suficiente para fijar una contraseña nueva.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const { createUserAndLogin, crearUsuario, login } = require('./helpers');

const put = (id, token, body) =>
  request(app)
    .put(`/api/usuarios/${id}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

describe('PUT /api/usuarios/:id — cambio de la propia contraseña', () => {
  it('sin indicar la contraseña actual → 400 y la vieja sigue sirviendo', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });

    const res = await put(yo.id, yo.token, { 'contraseña': 'NuevaClave123' });

    expect(res.status).toBe(400);
    await expect(login(yo.correo, 'MiClave123')).resolves.toEqual(expect.any(String));
  });

  it('con la contraseña actual equivocada → 403 y no se cambia nada', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });

    const res = await put(yo.id, yo.token, {
      'contraseñaActual': 'ESTA-NO-ES-LA-MIA',
      'contraseña': 'NuevaClave123'
    });

    expect(res.status).toBe(403);

    // La contraseña que intentó imponer el atacante no funciona...
    const intento = await request(app)
      .post('/api/auth/login')
      .send({ correo: yo.correo, 'contraseña': 'NuevaClave123' });
    expect(intento.status).toBe(400);

    // ...y la original sigue intacta.
    await expect(login(yo.correo, 'MiClave123')).resolves.toEqual(expect.any(String));
  });

  it('con la contraseña actual correcta → 200 y la nueva pasa a ser válida', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });

    const res = await put(yo.id, yo.token, {
      'contraseñaActual': 'MiClave123',
      'contraseña': 'NuevaClave123'
    });

    expect(res.status).toBe(200);

    await expect(login(yo.correo, 'NuevaClave123')).resolves.toEqual(expect.any(String));

    const vieja = await request(app)
      .post('/api/auth/login')
      .send({ correo: yo.correo, 'contraseña': 'MiClave123' });
    expect(vieja.status).toBe(400);
  });

  it('cambiar solo el nombre no exige contraseña actual', async () => {
    const yo = await createUserAndLogin('estudiante');

    const res = await put(yo.id, yo.token, { nombre: 'Nombre nuevo' });

    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Nombre nuevo');
  });

  it('un admin sí puede restablecer la contraseña de otra cuenta sin conocerla', async () => {
    // Es una acción administrativa, no un cambio propio: el admin está
    // devolviéndole el acceso a alguien que lo ha perdido.
    const admin = await createUserAndLogin('admin');
    const otro  = await crearUsuario({ rol: 'estudiante', password: 'LaSuya123' });

    const res = await put(otro.id, admin.token, { 'contraseña': 'Restablecida1' });

    expect(res.status).toBe(200);
    await expect(login(otro.correo, 'Restablecida1')).resolves.toEqual(expect.any(String));
  });

  it('el admin tampoco se libra al cambiar la SUYA propia', async () => {
    const admin = await createUserAndLogin('admin', { password: 'AdminClave1' });

    const res = await put(admin.id, admin.token, { 'contraseña': 'OtraClave1' });

    expect(res.status).toBe(400);
    await expect(login(admin.correo, 'AdminClave1')).resolves.toEqual(expect.any(String));
  });

  it('rechaza contraseñas de menos de 6 caracteres → 400', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });

    const res = await put(yo.id, yo.token, {
      'contraseñaActual': 'MiClave123',
      'contraseña': 'abc'
    });

    expect(res.status).toBe(400);
    await expect(login(yo.correo, 'MiClave123')).resolves.toEqual(expect.any(String));
  });
});
