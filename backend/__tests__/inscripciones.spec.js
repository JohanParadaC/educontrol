const request = require('supertest');
const app = require('../app');

describe('Inscripciones', () => {
  it('401 al intentar inscribirse sin token', async () => {
    await request(app)
      .post('/api/inscripciones')
      .send({ cursoId: 'cualquiera' })
      .expect(401);
  });
});