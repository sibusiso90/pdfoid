import { PDFDict, PDFDocument, PDFName } from '@cantoo/pdf-lib'

export interface ProtectOptions {
  /** Needed to open the file. */
  userPassword: string
  /** Grants full access; defaults to the user password. */
  ownerPassword?: string
}

/** Returns an AES-256 encrypted copy of the document. */
export async function encryptPdf(bytes: Uint8Array, { userPassword, ownerPassword }: ProtectOptions): Promise<Uint8Array> {
  if (!userPassword) throw new Error('Enter a password.')
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  doc.encrypt({ userPassword, ownerPassword: ownerPassword || userPassword })
  return doc.save()
}

/** Returns a decrypted copy that pdf-lib can edit. Throws if the password is wrong. */
export async function decryptPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { password, updateMetadata: false })
  // The objects are decrypted in memory, but the security handler is still
  // referenced and would be written back out, making the copy look encrypted.
  const { context } = doc
  delete context.trailerInfo.Encrypt
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Filter')) === PDFName.of('Standard')) context.delete(ref)
  }
  return doc.save()
}
