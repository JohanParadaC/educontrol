// Administración: crear un curso, asignarle profesor, matricular a alguien y
// borrarlo.
//
// El curso lleva un nombre único por ejecución y se borra al final: la base es
// una sola para toda la tanda.
import { expect, test } from '@playwright/test';
import { CUENTAS, entrar } from './apoyo';

const NOMBRE = `Curso de prueba ${Date.now()}`;

test.describe('Administración', () => {
  test('crea un curso, matricula a alguien y lo borra', async ({ page }) => {
    await entrar(page, CUENTAS.admin);
    await expect(page).toHaveURL(/\/admin/);

    // --- crear ---
    await page.getByRole('button', { name: 'Nuevo curso' }).click();
    const dialogo = page.locator('mat-dialog-container');
    await dialogo.getByLabel('Título').fill(NOMBRE);
    await dialogo.getByLabel('Descripción').fill('Creado por un test de extremo a extremo');
    await dialogo.getByLabel('Plazas').fill('5');
    await dialogo.getByLabel('Profesor').click();
    await page.getByRole('option', { name: /Marcos Rivas/ }).click();
    await dialogo.getByRole('button', { name: 'Crear' }).click();

    const fila = page.locator('.tabla-cursos tr', { hasText: NOMBRE });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText('Marcos Rivas');

    // --- matricular a alguien desde el menú de la fila ---
    await fila.getByRole('button', { name: /Más acciones/ }).click();
    await page.getByRole('menuitem', { name: 'Matricular a alguien' }).click();

    const matricular = page.locator('mat-dialog-container');
    await matricular.getByLabel('Estudiante').click();
    await page.getByRole('option', { name: /Sara Molina/ }).click();
    await matricular.getByRole('button', { name: 'Matricular' }).click();

    // La ficha del curso lo confirma: una plaza de cinco.
    await fila.getByRole('link', { name: NOMBRE }).click();
    await expect(page.getByRole('heading', { name: NOMBRE })).toBeVisible();
    await expect(page.locator('.meta__principal').last()).toHaveText('1 / 5 plazas');
    await expect(page.locator('.alumnos table')).toContainText('sara@educontrol.com');

    // --- borrar, con confirmación ---
    await page.goto('/admin');
    const otraVez = page.locator('.tabla-cursos tr', { hasText: NOMBRE });
    await otraVez.getByRole('button', { name: /Más acciones/ }).click();
    await page.getByRole('menuitem', { name: /Eliminar el curso/ }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();

    await expect(page.locator('.tabla-cursos tr', { hasText: NOMBRE })).toHaveCount(0);
  });

  test('el registro de actividad recoge lo que ha hecho administración', async ({ page }) => {
    await entrar(page, CUENTAS.admin);

    const actividad = page.locator('.actividad');
    await actividad.scrollIntoViewIfNeeded();

    // El sembrado deja tres entradas de ejemplo; el test de arriba añade las
    // suyas. Lo que se comprueba es que la tabla vive y filtra.
    await expect(actividad.locator('tbody tr').first()).toBeVisible();

    await actividad.getByLabel('Acción').click();
    await page.getByRole('option', { name: 'Curso creado' }).click();

    const acciones = actividad.locator('tbody tr .accion');
    await expect(acciones.first()).toHaveText('Curso creado');
    for (const texto of await acciones.allTextContents()) {
      expect(texto).toBe('Curso creado');
    }
  });
});
