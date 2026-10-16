import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  type PDFField,
} from '@cantoo/pdf-lib'

export type FormFieldType = 'text' | 'checkbox' | 'dropdown' | 'optionlist' | 'radio' | 'unsupported'
export type FormValue = string | boolean | string[]

export interface FormField {
  name: string
  type: FormFieldType
  value: FormValue
  options?: string[]
  readOnly: boolean
  multiline?: boolean
}

const describe = (field: PDFField): FormField => {
  const base = { name: field.getName(), readOnly: field.isReadOnly() }
  if (field instanceof PDFTextField) {
    return { ...base, type: 'text', value: field.getText() ?? '', multiline: field.isMultiline() }
  }
  if (field instanceof PDFCheckBox) return { ...base, type: 'checkbox', value: field.isChecked() }
  if (field instanceof PDFDropdown) return { ...base, type: 'dropdown', value: field.getSelected(), options: field.getOptions() }
  if (field instanceof PDFOptionList) return { ...base, type: 'optionlist', value: field.getSelected(), options: field.getOptions() }
  if (field instanceof PDFRadioGroup) return { ...base, type: 'radio', value: field.getSelected() ?? '', options: field.getOptions() }
  // Buttons and signature fields cannot be filled with a value.
  return { ...base, type: 'unsupported', value: '', readOnly: true }
}

/** Lists the document's AcroForm fields with their current values. */
export async function readFormFields(bytes: Uint8Array): Promise<FormField[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  return doc.getForm().getFields().map(describe)
}

/**
 * Sets field values by name. Unknown names throw so callers notice typos.
 * `flatten` bakes the values into the page content and removes the fields.
 */
export async function fillForm(
  bytes: Uint8Array,
  values: Record<string, FormValue>,
  opts: { flatten?: boolean } = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const form = doc.getForm()
  for (const [name, value] of Object.entries(values)) {
    const field = form.getField(name)
    if (field.isReadOnly()) continue
    if (field instanceof PDFTextField) field.setText(String(value))
    else if (field instanceof PDFCheckBox) (value === true || value === 'true' ? field.check() : field.uncheck())
    else if (field instanceof PDFDropdown || field instanceof PDFOptionList) field.select(Array.isArray(value) ? value : String(value))
    else if (field instanceof PDFRadioGroup) (value ? field.select(String(value)) : field.clear())
  }
  if (opts.flatten) form.flatten()
  return doc.save()
}
