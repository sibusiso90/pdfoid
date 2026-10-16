import { describe, it, expect } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { fillForm, readFormFields } from '../utils/pdfOps/forms'
import { extractPageTexts } from './utils/realPdf'

const makeForm = async () => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 400])
  const form = doc.getForm()
  form.createTextField('name').addToPage(page, { x: 20, y: 320, width: 200, height: 24 })
  form.createCheckBox('agree').addToPage(page, { x: 20, y: 280, width: 16, height: 16 })
  const country = form.createDropdown('country')
  country.addOptions(['South Africa', 'Kenya'])
  country.addToPage(page, { x: 20, y: 240, width: 200, height: 24 })
  const plan = form.createRadioGroup('plan')
  plan.addOptionToPage('basic', page, { x: 20, y: 200, width: 16, height: 16 })
  plan.addOptionToPage('pro', page, { x: 60, y: 200, width: 16, height: 16 })
  const locked = form.createTextField('ref')
  locked.setText('R-1')
  locked.enableReadOnly()
  locked.addToPage(page, { x: 20, y: 160, width: 200, height: 24 })
  return doc.save()
}

describe('forms', () => {
  it('reads field types, options and read-only state', async () => {
    const fields = await readFormFields(await makeForm())
    expect(fields.map((f) => [f.name, f.type])).toEqual([
      ['name', 'text'], ['agree', 'checkbox'], ['country', 'dropdown'], ['plan', 'radio'], ['ref', 'text'],
    ])
    expect(fields.find((f) => f.name === 'country')?.options).toEqual(['South Africa', 'Kenya'])
    expect(fields.find((f) => f.name === 'ref')).toMatchObject({ readOnly: true, value: 'R-1' })
  })

  it('fills values and reads them back, leaving read-only fields alone', async () => {
    const filled = await fillForm(await makeForm(), { name: 'Thandi', agree: true, country: ['Kenya'], plan: 'pro', ref: 'X' })
    const byName = Object.fromEntries((await readFormFields(filled)).map((f) => [f.name, f.value]))
    expect(byName).toEqual({ name: 'Thandi', agree: true, country: ['Kenya'], plan: 'pro', ref: 'R-1' })
  })

  it('flattening removes the fields but keeps the text visible', async () => {
    const flat = await fillForm(await makeForm(), { name: 'Thandi' }, { flatten: true })
    expect(await readFormFields(flat)).toEqual([])
    expect((await extractPageTexts(flat))[0]).toContain('Thandi')
  })

  it('throws on an unknown field name', async () => {
    await expect(fillForm(await makeForm(), { nope: 'x' })).rejects.toThrow()
  })
})
