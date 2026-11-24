import { expect, test } from '@playwright/test'

test('dashboard shows four certification tracks with real objective counts', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Progress saved locally')).toBeVisible()
  for (const name of ['Azure Administrator', 'Azure Fundamentals', 'Azure AI Fundamentals', 'AWS Cloud Practitioner']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  await expect(page.locator('article', { hasText: 'AZ-104' }).first()).toContainText('81')
})

test('every navigation link renders a page without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  const links = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all()
  const hrefs = await Promise.all(links.map((l) => l.getAttribute('href')))
  for (const href of hrefs) {
    await page.goto(href!)
    await expect(page.locator('main h1, main h2').first()).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('NSG lesson: packet denied, rule fixes it, lesson completion persists', async ({ page }) => {
  await page.goto('/lesson/az104-nsg-asg')
  await page.getByRole('button', { name: 'Send packet' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'DENIED' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Add rule' }).click()
  await page.getByRole('button', { name: 'Send packet' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'ALLOWED' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Full lesson', exact: true }).click()
  await expect(page.getByRole('tab', { name: /Lab \(2\/3\)/ })).toBeVisible()
  await page.getByRole('button', { name: 'Mark lesson complete' }).click()
  await expect(page.getByRole('button', { name: /Completed/ })).toBeVisible()
  await page.goto('/reviews')
  await expect(page.getByText(/objective\(s\) due for review/)).toContainText('2')
})

test('AZ-104 lesson opens in the easy view with walkthrough, simulator and real-Azure lab', async ({ page }) => {
  await page.goto('/lesson/az104-rbac')
  await expect(page.getByRole('region', { name: 'Step-by-step walkthrough' }).or(page.getByLabel('Step-by-step walkthrough'))).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Try it yourself in the simulator' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Hands-on in Azure:/ })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Step 1 done' }).check()
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Step 1 done' })).toBeChecked()
})

test('practice: answer a question and record mastery evidence', async ({ page }) => {
  await page.goto('/practice?exam=az-104&mode=topic')
  await page.getByLabel('Skill area').selectOption('AZ104-1.2')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('fieldset label').first().click()
  await page.getByRole('button', { name: 'Check answer' }).click()
  await expect(page.getByText(/^(Correct|Incorrect)$/)).toBeVisible()
  await expect(page.getByText('Docs:')).toBeVisible()
})

test('diagnostic produces a foundation plan', async ({ page }) => {
  await page.goto('/diagnostic')
  for (;;) {
    const finish = page.getByRole('button', { name: 'Finish' })
    if (await finish.isVisible()) { await finish.click(); break }
    await page.getByRole('button', { name: 'Next ▶' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Your foundation plan' })).toBeVisible()
  await expect(page.getByText(/You missed 12 of 12/)).toBeVisible()
})

test('governance lesson: Modify inherits a tag so Deny passes; locks block RG deletion', async ({ page }) => {
  await page.goto('/lesson/az104-policy-tags')
  await page.getByRole('button', { name: 'Require + inherit costCenter tag' }).click()
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'SUCCEEDED' })).toContainText('CC-100', { timeout: 20_000 })
  await page.goto('/lesson/az104-resource-locks')
  await page.getByRole('button', { name: 'Delete RG that contains a locked resource' }).click()
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'REJECTED' })).toContainText('inside it', { timeout: 20_000 })
  await page.getByRole('button', { name: 'Full lesson', exact: true }).click()
  await expect(page.getByRole('tab', { name: /Lab \(2\/3\)/ })).toBeVisible()
})
