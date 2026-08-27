// El profesor: ve sus clases, entra en una y lee la lista de alumnos.
//
// No toca nada, así que no tiene nada que deshacer.
import { expect, test } from '@playwright/test';
import { CUENTAS, entrar } from './apoyo';

test.describe('Profesor', () => {
  test('ve solo sus clases, con el recuento de cada una', async ({ page }) => {
    await entrar(page, CUENTAS.lucia);
    await expect(page).toHaveURL(/\/profesor\/dashboard/);

    await page.goto('/profesor/clases');

    const tarjetas = page.locator('li.course');
    await expect(tarjetas).toHaveCount(2); // los dos de Lucía, no los cuatro
    await expect(tarjetas.filter({ hasText: 'Angular desde cero' })).toBeVisible();
    // Los de Marcos no son suyos y no salen.
    await expect(page.getByText('Testing automatizado')).toHaveCount(0);

    // Angular tiene cupo 20 y dos matriculados por el sembrado.
    await expect(tarjetas.filter({ hasText: 'Angular' }).locator('.chip')).toContainText('2 / 20');
  });

  test('entra en una clase y ve quién está matriculado', async ({ page }) => {
    await entrar(page, CUENTAS.lucia);
    await page.goto('/profesor/clases');

    await page
      .locator('li.course', { hasText: 'Angular desde cero' })
      .getByRole('link', { name: 'Angular desde cero' })
      .click();

    await expect(page.getByRole('heading', { name: 'Angular desde cero' })).toBeVisible();

    // La tabla de alumnos: es suya, así que la ve entera.
    const tabla = page.locator('.alumnos table');
    await expect(tabla).toBeVisible();
    await expect(tabla.locator('tbody tr')).toHaveCount(2);
    await expect(tabla).toContainText('ana@educontrol.com');

    // Y tiene las acciones de quien gestiona el curso, acotadas a la ficha.
    const acciones = page.locator('.ficha__acciones');
    await expect(acciones.getByRole('button', { name: 'Matricular estudiante' })).toBeVisible();
    await expect(acciones.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(acciones.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();
  });

  test('exportar descarga un CSV con el nombre que manda el servidor', async ({ page }) => {
    await entrar(page, CUENTAS.lucia);
    await page.goto('/profesor/clases');
    await page
      .locator('li.course', { hasText: 'Angular desde cero' })
      .getByRole('link', { name: 'Angular desde cero' })
      .click();

    // Hay que esperar a la ficha antes de buscar el botón: "Mis clases" tiene
    // su propio "Exportar CSV" por tarjeta y, mientras la navegación está en
    // vuelo, el localizador encuentra los dos.
    await expect(page.getByRole('heading', { name: 'Angular desde cero' })).toBeVisible();

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.ficha__acciones').getByRole('button', { name: 'Exportar CSV' }).click(),
    ]);

    expect(descarga.suggestedFilename()).toBe('Angular desde cero - estudiantes.csv');
  });
});
