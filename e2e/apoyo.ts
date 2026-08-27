// e2e/apoyo.ts
// ---------------------------------------------------------------------------
// Lo que comparten los tests de extremo a extremo.
//
// Las cuentas son las que siembra `backend/scripts/seedDemo.js` cuando la base
// es efímera, que es siempre en estos tests.
// ---------------------------------------------------------------------------
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const CUENTAS = {
  admin: { correo: 'admin@educontrol.com', password: 'Admin123*' },
  lucia: { correo: 'lucia@educontrol.com', password: 'Demo1234' },
  marcos: { correo: 'marcos@educontrol.com', password: 'Demo1234' },
  ana: { correo: 'ana@educontrol.com', password: 'Demo1234' },
  // Sara solo está en el curso archivado: sirve para probar los cursos en los
  // que Ana y Diego ya están matriculados por el sembrado.
  sara: { correo: 'sara@educontrol.com', password: 'Demo1234' },
} as const;

/** El campo del backend lleva tilde; escribirlo mal da un 400 sin pistas. */
const CLAVE = 'contraseña';

/** Entra por el formulario y espera a salir de /login. */
export async function entrar(page: Page, cuenta: { correo: string; password: string }) {
  await page.goto('/login');
  await page.locator('input[type=email]').fill(cuenta.correo);
  await page.locator('input[type=password]').fill(cuenta.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Un token de la API, para las comprobaciones que no pasan por la interfaz. */
export async function token(
  peticion: APIRequestContext,
  cuenta: { correo: string; password: string }
) {
  const res = await peticion.post('/api/auth/login', {
    data: { correo: cuenta.correo, [CLAVE]: cuenta.password },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token as string;
}

/** Id de un curso por su nombre, preguntando a la API. */
export async function idDeCurso(peticion: APIRequestContext, jwt: string, nombre: string) {
  const res = await peticion.get('/api/cursos?limit=100', {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const { cursos } = await res.json();
  const curso = cursos.find((c: { nombre: string }) => c.nombre === nombre);
  expect(curso, `no encuentro el curso "${nombre}" en los datos de ejemplo`).toBeTruthy();
  return curso._id as string;
}
