// Regresión del Prompt 2: el rol dice qué clase de usuario entra, pero de
// quién es el curso lo decide el controlador leyéndolo.
//
// Se comprueba por los dos lados. La interfaz no le ofrece a un profesor las
// acciones de un curso ajeno, pero eso solo prueba que la pantalla se porta
// bien: la puerta de verdad es el servidor, y ahí se llama sin navegador.
import { expect, test } from '@playwright/test';
import { CUENTAS, entrar, idDeCurso, token } from './apoyo';

const AJENO = 'Testing automatizado'; // lo imparte Marcos

test.describe('Un profesor no toca los cursos de otro', () => {
  test('la ficha de un curso ajeno no le ofrece editar ni exportar', async ({ page }) => {
    await entrar(page, CUENTAS.lucia);

    await page.goto('/cursos');
    await page
      .locator('mat-card.course', { hasText: AJENO })
      .getByRole('link', { name: 'Ver el curso' })
      .click();

    await expect(page.getByRole('heading', { name: AJENO })).toBeVisible();

    // Ve el curso y su contexto —profesor y cuántos hay—, como cualquiera.
    await expect(page.locator('.ficha__meta .meta')).toHaveCount(2);

    // Y nada más: ni acciones ni lista de alumnos. Ni siquiera la franja de
    // acciones existe, que es lo que se comprueba primero.
    await expect(page.locator('.ficha__acciones')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exportar CSV' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Matricular estudiante' })).toHaveCount(0);
    await expect(page.locator('.alumnos')).toHaveCount(0);
  });

  test('y el servidor tampoco se lo deja, aunque llame sin pasar por la interfaz', async ({
    request,
  }) => {
    const jwtLucia = await token(request, CUENTAS.lucia);
    const jwtMarcos = await token(request, CUENTAS.marcos);
    const curso = await idDeCurso(request, jwtMarcos, AJENO);

    const editar = await request.put(`/api/cursos/${curso}`, {
      headers: { Authorization: `Bearer ${jwtLucia}` },
      data: { nombre: 'Secuestrado' },
    });
    expect(editar.status()).toBe(403);

    const borrar = await request.delete(`/api/cursos/${curso}`, {
      headers: { Authorization: `Bearer ${jwtLucia}` },
    });
    expect(borrar.status()).toBe(403);

    const csv = await request.get(`/api/cursos/${curso}/estudiantes.csv`, {
      headers: { Authorization: `Bearer ${jwtLucia}` },
    });
    expect(csv.status()).toBe(403);

    // Y un 403 no basta: hay que comprobar que el curso sigue como estaba.
    const ficha = await request.get(`/api/cursos/${curso}`, {
      headers: { Authorization: `Bearer ${jwtMarcos}` },
    });
    const { curso: despues } = await ficha.json();
    expect(despues.nombre).toBe(AJENO);
  });

  test('el estudiante no ve a sus compañeros ni por la API', async ({ request }) => {
    const jwtAna = await token(request, CUENTAS.ana);
    const jwtMarcos = await token(request, CUENTAS.marcos);
    const curso = await idDeCurso(request, jwtMarcos, AJENO);

    const ficha = await request.get(`/api/cursos/${curso}`, {
      headers: { Authorization: `Bearer ${jwtAna}` },
    });
    const cuerpo = await ficha.json();

    // Cuántos son, sí. Quiénes, no: la clave ni siquiera viene.
    expect(typeof cuerpo.matriculados).toBe('number');
    expect(cuerpo.estudiantes).toBeUndefined();
    expect(JSON.stringify(cuerpo)).not.toContain('diego@educontrol.com');
  });

  test('el historial de actividad es solo de administración', async ({ request }) => {
    const jwtLucia = await token(request, CUENTAS.lucia);
    const jwtAna = await token(request, CUENTAS.ana);

    for (const jwt of [jwtLucia, jwtAna]) {
      const res = await request.get('/api/auditoria', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(res.status()).toBe(403);
    }
  });
});
