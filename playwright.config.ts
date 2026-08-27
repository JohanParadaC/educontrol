// playwright.config.ts
// ---------------------------------------------------------------------------
// Los tests de extremo a extremo: la aplicación de verdad, en un navegador de
// verdad, contra su propio servidor.
//
// `webServer` levanta el proyecto con `npm run serve`, que construye el
// frontend y arranca Express. No hace falta instalar MongoDB: sin MONGO_URI, el
// servidor levanta uno en memoria y lo siembra con los datos de ejemplo, así
// que cada ejecución empieza con el mismo escenario conocido.
//
// **Un solo worker, a propósito.** Los tres roles comparten una única base de
// datos: en paralelo se pisarían las matrículas. Que vayan en serie no es lo
// mismo que depender del orden — cada test deja la base como se la encontró, y
// por eso se pueden ejecutar sueltos con `-g`.
// ---------------------------------------------------------------------------
import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },

  fullyParallel: false,
  workers: 1,

  // En CI, un `.only` olvidado dejaría pasar una rama sin probar el resto.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE,
    // Solo cuando algo falla: en verde no interesa y ocupa.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run serve',
    // Se espera al health-check y no al puerto: el puerto responde antes de
    // que Mongo esté conectado y sembrado.
    url: `${BASE}/api/health`,
    // En local se reutiliza el servidor que ya haya levantado; en CI, nunca:
    // ahí no debe haber nada corriendo de antes.
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
