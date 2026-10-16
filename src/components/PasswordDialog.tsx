import React, { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { LockKey } from '@phosphor-icons/react'
import { usePdfEditorStore } from '../store/pdfEditorStore'
import { Dialog } from './Dialog'
import { Button } from './ui'
import { fieldClass } from './inspector'

/**
 * Shown when an opened PDF is encrypted. The store holds the file until a password
 * is submitted or the prompt is cancelled.
 */
export function PasswordDialog() {
  const { request, submitPassword, cancel } = usePdfEditorStore(
    useShallow((s) => ({
      request: s.passwordRequest,
      submitPassword: s.submitPassword,
      cancel: s.cancelPasswordRequest,
    }))
  )
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Clear the field for each new prompt, and after a wrong password
  useEffect(() => {
    setPassword('')
    inputRef.current?.focus()
  }, [request])

  const incorrect = request?.reason === 'incorrect'

  return (
    <Dialog
      open={request !== null}
      onClose={cancel}
      icon={<LockKey size={20} />}
      title="This PDF is password protected"
      description={<>Enter the password to open <span className="font-medium text-[var(--pdfoid-text)] break-all">{request?.fileName}</span>.</>}
      initialFocusRef={inputRef}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!password) return
          setSubmitting(true)
          try {
            await submitPassword(password)
          } finally {
            setSubmitting(false)
          }
        }}
      >
        <label htmlFor="pdf-password" className="sr-only">Password</label>
        <input
          ref={inputRef}
          id="pdf-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${fieldClass} ${incorrect ? 'border-[var(--pdfoid-danger)]' : ''}`}
          aria-invalid={incorrect || undefined}
          aria-describedby={incorrect ? 'pdf-password-error' : undefined}
          placeholder="Password"
        />
        {incorrect && (
          <p id="pdf-password-error" className="mt-2 text-sm text-[var(--pdfoid-danger)]" role="alert">
            That password is incorrect. Try again.
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="secondary" onClick={cancel}>Cancel</Button>
          <Button type="submit" variant="primary" isLoading={submitting} disabled={!password}>Unlock</Button>
        </div>
      </form>
    </Dialog>
  )
}
