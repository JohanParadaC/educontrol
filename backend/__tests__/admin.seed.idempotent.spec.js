const request = require('supertest');
const app = require('../app');

describe('Admin seed idempotente', () => {
  it('permite ejecutar seed-admin dos veces', async () => {
    const payload = { correo: 'admin@educontrol.com', password: 'admin123', nombre: 'Admin' };

    const r1 = await request(app).post('/api/admin/seed-admin').send(payload);
    expect([200, 201]).toContain(r1.status);

    const r2 = await request(app).post('/api/admin/seed-admin').send(payload);
    expect([200, 201]).toContain(r2.status);
  });
});