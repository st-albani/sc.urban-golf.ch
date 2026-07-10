import { test, expect } from './fixtures'

// 1×1-PNG (rot) als minimaler gültiger Upload.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  const sheet = page.locator('.sheet').last()
  await sheet.locator('#auth-email').fill('spieler@example.com')
  await sheet.getByRole('button', { name: 'Code anfordern' }).click()
  await sheet.locator('#auth-code').fill('123456')
  await sheet.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.locator('.sheet')).toHaveCount(0)
}

test.describe('Profil & Avatar (Smoke)', () => {
  test('Bild-Upload setzt ein Avatarbild im Profil-Header', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)
    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()

    // Datei ins versteckte Input legen (Kamera-Button triggert es sonst).
    await page.locator('.profile__file').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    })

    // Header rendert nun ein Bild statt Initialen.
    await expect(page.locator('.profile .avatar--image img')).toBeVisible()
    await expect(page.getByText(/aktualisiert/)).toBeVisible()
  })

  test('Profil-Header zeigt E-Mail nach Login', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)
    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await expect(page.locator('.profile__email')).toHaveText('spieler@example.com')
  })
})
