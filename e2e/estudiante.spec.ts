// El recorrido completo del estudiante: entra, busca, se matricula, lo ve en
// "Mis cursos" y se da de baja.
//
// Termina exactamente donde empezó, a propósito: la base es única para toda la
// tanda y un test que deja rastro convierte al siguiente en una lotería.
import { expect, test } from '@playwright/test';
import { CUENTAS, entrar } from './apoyo';

const CURSO = 'Node.js y APIs REST'; // abierto, sin cupo y Ana no está dentro

test.describe('Estudiante', () => {
  test('se matricula, lo ve en sus cursos y se da de baja', async ({ page }) => {
    await entrar(page, CUENTAS.ana);
    await expect(page).toHaveURL(/\/estudiante\/inicio/);

    // --- catálogo: buscar el curso ---
    await page.goto('/cursos');
    // `getByRole('textbox')` y no `getByLabel`: el buscador de la barra superior
    // se llama "Buscar cursos" y una etiqueta por subcadena resuelve a los dos.
    await page.getByRole('textbox', { name: 'Buscar curso', exact: true }).fill('Node');

    const tarjeta = page.locator('mat-card.course', { hasText: CURSO });
    await expect(tarjeta).toBeVisible();
    // La búsqueda la resuelve el servidor: lo que no coincide no llega.
    await expect(page.locator('mat-card.course')).toHaveCount(1);

    // --- matricularse ---
    await tarjeta.getByRole('button', { name: 'Matricular' }).click();
    await expect(tarjeta.getByRole('button', { name: 'Ya inscrito' })).toBeVisible();

    // --- aparece en "Mis cursos" ---
    await page.goto('/mis-cursos');
    const fila = page.locator('mat-card.course', { hasText: CURSO });
    await expect(fila).toBeVisible();

    // --- darse de baja, y dejar la base como estaba ---
    await fila.getByRole('button', { name: 'Cancelar matrícula' }).click();
    // Solo ESA desaparece: Ana sigue matriculada en los dos cursos que le da
    // el sembrado, y comprobar "no tienes cursos" sería comprobar una mentira.
    await expect(fila).toHaveCount(0);
    await expect(page.locator('mat-card.course')).toHaveCount(2);
  });

  test('desde la ficha del curso también, y el número de matriculados sube', async ({ page }) => {
    await entrar(page, CUENTAS.ana);

    await page.goto('/cursos');
    // `getByRole('textbox')` y no `getByLabel`: el buscador de la barra superior
    // se llama "Buscar cursos" y una etiqueta por subcadena resuelve a los dos.
    await page.getByRole('textbox', { name: 'Buscar curso', exact: true }).fill('Node');
    await page
      .locator('mat-card.course', { hasText: CURSO })
      .getByRole('link', { name: 'Ver el curso' })
      .click();

    await expect(page.getByRole('heading', { name: CURSO })).toBeVisible();
    await expect(page.locator('.meta__principal').last()).toHaveText('0');

    await page.getByRole('button', { name: 'Matricularme' }).click();
    await expect(page.getByRole('button', { name: 'Cancelar matrícula' })).toBeVisible();
    await expect(page.locator('.meta__principal').last()).toHaveText('1');

    // Un estudiante ve cuántos son, no quiénes: la lista no existe para él.
    await expect(page.locator('.alumnos')).toHaveCount(0);

    // Se deshace: confirmación incluida.
    await page.getByRole('button', { name: 'Cancelar matrícula' }).click();
    await page.getByRole('button', { name: 'Cancelar matrícula' }).last().click();
    await expect(page.getByRole('button', { name: 'Matricularme' })).toBeVisible();
  });

  test('un curso cerrado se ve, pero no deja matricularse y dice por qué', async ({ page }) => {
    // Sara y no Ana: Ana ya está matriculada en "Testing" por el sembrado, y
    // entonces el botón sería el de darse de baja.
    await entrar(page, CUENTAS.sara);
    await page.goto('/cursos');

    const cerrado = page.locator('mat-card.course', { hasText: 'Testing automatizado' });
    await cerrado.getByRole('link', { name: 'Ver el curso' }).click();

    // El distintivo, no cualquier texto que diga "cerrado": el motivo de abajo
    // también lleva la palabra.
    await expect(page.locator('.estado')).toHaveText('Cerrado');
    const boton = page.getByRole('button', { name: 'Matricularme' });
    await expect(boton).toBeDisabled();
    await expect(page.getByText('Este curso está cerrado a nuevas matrículas.')).toBeVisible();
  });

  test('los cursos archivados no salen en el catálogo', async ({ page }) => {
    await entrar(page, CUENTAS.ana);
    await page.goto('/cursos');

    await expect(page.locator('mat-card.course').first()).toBeVisible();
    await expect(page.getByText('Bases de datos con MongoDB')).toHaveCount(0);
  });
});
