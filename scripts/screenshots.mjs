// Drives the running app in Chromium and saves one screenshot per feature to ../screenshots.
// Expects a freshly seeded backend (see README) and the Vite dev server on APP_URL.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
//   PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/screenshots.mjs

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots')
const PASSWORD = 'tradehub-demo'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE })

async function session(username) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } })
  const page = await context.newPage()
  page.on('dialog', (d) => d.accept())
  if (username) {
    await page.goto(`${APP}/login`)
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('heading', { name: /Marketplace/ }).waitFor()
  }
  return page
}

async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage })
  console.log('saved', name)
}

const toast = (page, text) => page.locator('.toast', { hasText: text }).waitFor()

// 1. Registration: inline validation error, then success.
let page = await session()
await page.goto(`${APP}/register`)
await page.getByLabel('Username').fill('dave')
await page.getByLabel('Password').fill('password')
await page.getByRole('button', { name: 'Create account' }).click()
await page.locator('.field-error').waitFor()
await shot(page, '01a-register-validation')
await page.getByLabel('Password').fill('a-strong-pass-42')
await page.getByRole('button', { name: 'Create account' }).click()
await page.getByRole('heading', { name: /Marketplace/ }).waitFor()
await page.goto(`${APP}/inventory`)
await page.locator('.item-card').first().waitFor()
await shot(page, '01b-register-starter-inventory')
await page.context().close()

// 2. Login: wrong password shows the 401 message.
page = await session()
await page.goto(`${APP}/login`)
await page.getByLabel('Username').fill('alice')
await page.getByLabel('Password').fill('wrong-password')
await page.getByRole('button', { name: 'Sign in' }).click()
await toast(page, 'Wrong username or password')
await shot(page, '02-login-error')
await page.context().close()

// 3, 8. Alice: wallet in the header and the filtered marketplace.
page = await session('alice')
await page.locator('tbody tr').first().waitFor()
await shot(page, '03-marketplace-and-wallet')
await page.getByLabel('Category').selectOption('weapon')
await page.getByLabel('Min rarity').selectOption('3')
await page.getByRole('button', { name: 'Apply' }).click()
await page.waitForURL(/category=weapon/)
await page.locator('tbody tr').first().waitFor()
await shot(page, '08-marketplace-filters')

// 4, 6, 12. Inventory, fixed-price listing, cancel.
await page.goto(`${APP}/inventory`)
await page.locator('.item-card').first().waitFor()
await shot(page, '04-inventory')
const sellable = page.locator('.item-card', { has: page.getByRole('button', { name: 'Sell' }) })
await sellable.last().getByRole('button', { name: 'Sell' }).click()
await page.getByLabel('Price (gold)').fill('45')
await shot(page, '06a-create-fixed-listing')
await page.getByRole('button', { name: 'List item' }).click()
await toast(page, 'is now on the market')
await shot(page, '06b-fixed-listing-created')
await page.getByRole('button', { name: 'Cancel listing' }).click()
await toast(page, 'Listing cancelled')
await shot(page, '12-cancel-listing')

// 7. Auction listing.
await page.goto(`${APP}/inventory`)
await sellable.last().getByRole('button', { name: 'Sell' }).click()
await page.getByLabel('Auction').check()
await page.getByLabel('Opening bid (gold)').fill('30')
await page.getByLabel('Duration (hours, 1-72)').fill('12')
await shot(page, '07a-create-auction')
await page.getByRole('button', { name: 'List item' }).click()
await toast(page, 'is now on the market')
await shot(page, '07b-auction-created')

// 14. Incoming trade offer, and building a new one.
await page.goto(`${APP}/trades`)
await page.locator('.trade-card').first().waitFor()
await shot(page, '14a-incoming-trade')
await page.getByRole('link', { name: 'New offer' }).click()
await page.getByLabel('Trade with').selectOption('cara')
await page.locator('fieldset', { hasText: 'You give' }).locator('input').first().check()
await page.locator('fieldset', { hasText: 'You get from cara' }).locator('input').first().check()
await page.getByLabel('Message (optional)').fill('Fair swap?')
await shot(page, '14b-new-trade-offer')
await page.getByRole('button', { name: 'Send offer' }).click()
await toast(page, 'Offer sent to cara')
await shot(page, '14c-trade-sent')
await page.context().close()

// 11, 15. Bob: buy now, insufficient gold, then his ledger (bid hold, outbid refund, purchase).
page = await session('bob')
await page.goto(`${APP}/listings/2`)
await page.getByRole('button', { name: /Buy now/ }).click()
await toast(page, 'You bought')
await shot(page, '11a-buy-now')
await page.goto(`${APP}/listings/7`)
await page.getByRole('button', { name: /Buy now/ }).click()
await toast(page, 'Not enough gold')
await shot(page, '11b-buy-now-insufficient-gold')
await page.goto(`${APP}/history`)
await page.locator('tbody tr').first().waitFor()
await shot(page, '15-transaction-history')
await page.context().close()

// 9, 10, 13. Cara: auction detail, outbid Bob, the settled auction she won, accepting Alice's offer.
page = await session('cara')
await page.goto(`${APP}/listings/1`)
await page.getByRole('heading', { name: 'Bid history' }).waitFor()
await shot(page, '09-auction-detail-bid-history')
await page.getByLabel(/Your bid/).fill('640')
await page.getByRole('button', { name: 'Place bid' }).click()
await toast(page, 'Bid of 640g placed')
await shot(page, '10-place-bid')
await page.goto(`${APP}/listings/8`)
await page.getByText('Winner').waitFor()
await shot(page, '13-auction-settled')
await page.goto(`${APP}/trades`)
await page.getByRole('button', { name: 'Accept' }).first().click()
await toast(page, 'Trade accepted')
await shot(page, '14d-trade-accepted')

// Error handling: unknown listing returns 404.
await page.goto(`${APP}/listings/9999`)
await page.getByRole('alert').waitFor()
await shot(page, '16-error-404')
await page.context().close()

// 5. Catalog with the staff-only form.
page = await session('admin')
await page.goto(`${APP}/catalog`)
await page.locator('tbody tr').first().waitFor()
await shot(page, '05-item-catalog-admin', true)

await browser.close()
