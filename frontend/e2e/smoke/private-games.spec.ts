import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

async function signIn(page: Page) {
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

async function createPrivateGame(page: Page, name: string) {
  await page.goto('/games/new')
  await page.locator('input#game-name').fill(name)
  // Die „Du"-Zeile genügt als Spieler 1.
  await expect(page.locator('.new-game__player--self')).toBeVisible()
  await page.getByRole('tab', { name: 'Privat' }).click()
  await page.getByRole('button', { name: 'Spiel starten' }).click()
  await page.waitForURL(/\/games\/[^/]+\/1$/)
}

test.describe('Private Spiele (Smoke)', () => {
  test('der Sichtbarkeits-Umschalter erscheint nur eingeloggt', async ({ page, mockApi }) => {
    void mockApi

    // Anonym: kein Umschalter.
    await page.goto('/games/new')
    await expect(page.getByRole('tab', { name: 'Privat' })).toHaveCount(0)

    // Eingeloggt: Umschalter mit „Öffentlich" / „Privat" ist da (Default öffentlich).
    await signIn(page)
    await page.goto('/games/new')
    await expect(page.getByRole('tab', { name: 'Öffentlich' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Privat' })).toBeVisible()
  })

  test('ein privates Spiel erscheint in „Meine" mit Badge', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)
    await createPrivateGame(page, 'Geheime Feierabendrunde')

    await page.goto('/games')
    await page.getByRole('tab', { name: 'Meine' }).click()

    const item = page.locator('.games-list__item', { hasText: 'Geheime Feierabendrunde' })
    await expect(item).toBeVisible()
    await expect(item.locator('.mine__badge')).toHaveText(/Privat/)
  })

  test('die Teilen-Ansicht kommuniziert die Zugriffs-Einschränkung (Phase 2)', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)
    await createPrivateGame(page, 'Teilen-Privat-Runde')

    // Vom Loch-View in die Detail-Ansicht wechseln und Teilen öffnen.
    const gameId = new URL(page.url()).pathname.split('/')[2]
    await page.goto(`/games/${gameId}`)
    await page.getByRole('button', { name: 'Spiel teilen' }).click()

    await expect(page.locator('.share__notice')).toContainText('Nur du und angemeldete Mitspieler')
  })

  test('anonym ist das private Spiel nicht in „Alle", öffentliche schon', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)
    await createPrivateGame(page, 'Nur-für-mich-Runde')

    // Abmelden → nun anonyme Sicht auf die öffentliche „Alle"-Liste.
    await page.goto('/')
    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await page.getByRole('button', { name: 'Abmelden' }).click()

    await page.goto('/games')
    // Öffentliche Fixture-Runde bleibt sichtbar; die private ist ausgeblendet.
    await expect(page.getByText('Stadtpark-Runde')).toBeVisible()
    await expect(page.getByText('Nur-für-mich-Runde')).toHaveCount(0)
  })
})
