import { Link } from '@tanstack/react-router'
import type { AdminPrincipalSummary } from '../../api/types'
import { ApiErrorMessage } from '../../components/Primitives'

export type PrincipalEntryMode = 'existing' | 'manual'

export function PrincipalLinkFields({
  availablePrincipals,
  disabled = false,
  error,
  loading = false,
  manualName,
  manualPhone,
  mode,
  onManualNameChange,
  onManualPhoneChange,
  onModeChange,
  onSelectedPrincipalIdChange,
  selectedPrincipalId,
}: {
  availablePrincipals: AdminPrincipalSummary[]
  disabled?: boolean
  error?: unknown
  loading?: boolean
  manualName: string
  manualPhone: string
  mode: PrincipalEntryMode
  onManualNameChange: (value: string) => void
  onManualPhoneChange: (value: string) => void
  onModeChange: (mode: PrincipalEntryMode) => void
  onSelectedPrincipalIdChange: (value: string) => void
  selectedPrincipalId: string
}) {
  const selectedPrincipal = availablePrincipals.find((principal) => principal.id === selectedPrincipalId)

  return (
    <div className="principal-link-panel full-span">
      <div className="segmented-control" role="radiogroup" aria-label="Principal entry mode">
        <button
          aria-checked={mode === 'existing'}
          className={mode === 'existing' ? 'active' : ''}
          disabled={disabled || availablePrincipals.length === 0}
          onClick={() => onModeChange('existing')}
          role="radio"
          type="button"
        >
          Link account
        </button>
        <button
          aria-checked={mode === 'manual'}
          className={mode === 'manual' ? 'active' : ''}
          disabled={disabled}
          onClick={() => onModeChange('manual')}
          role="radio"
          type="button"
        >
          Manual details
        </button>
      </div>

      <ApiErrorMessage error={error} />

      {mode === 'existing' ? (
        <>
          {loading ? (
            <div className="directory-empty-state" role="status">
              <strong>Loading principal accounts</strong>
              <span>Checking the principal directory before this trip is linked.</span>
            </div>
          ) : availablePrincipals.length === 0 ? (
            <div className="directory-empty-state">
              <strong>No principal accounts available</strong>
              <span>Invite the principal first, or keep this trip on manual details.</span>
              <Link className="text-link" to="/admin/invitations">Invite principal</Link>
            </div>
          ) : (
            <section className="principal-directory-grid">
              <label className="field">
                <span>Principal account</span>
                <select
                  disabled={disabled}
                  value={selectedPrincipalId}
                  onChange={(event) => onSelectedPrincipalIdChange(event.target.value)}
                >
                  <option value="">Select principal account</option>
                  {availablePrincipals.map((principal) => (
                    <option key={principal.id} value={principal.id}>
                      {principal.fullName} · {principal.email}
                    </option>
                  ))}
                </select>
              </label>
              {selectedPrincipal && <PrincipalAccountPreview principal={selectedPrincipal} />}
            </section>
          )}
        </>
      ) : (
        <section className="form-grid">
          <label className="field">
            <span>Principal name</span>
            <input
              disabled={disabled}
              value={manualName}
              onChange={(event) => onManualNameChange(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Principal phone</span>
            <input
              disabled={disabled}
              value={manualPhone}
              onChange={(event) => onManualPhoneChange(event.target.value)}
            />
          </label>
        </section>
      )}
    </div>
  )
}

function PrincipalAccountPreview({ principal }: { principal: AdminPrincipalSummary }) {
  return (
    <aside className="principal-account-preview">
      <p className="eyebrow">Directory record</p>
      <strong>{principal.fullName}</strong>
      <dl>
        <div>
          <dt>Email</dt>
          <dd>{principal.email}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{principal.phone ?? 'Not provided'}</dd>
        </div>
        <div>
          <dt>Linked trips</dt>
          <dd>{principal.trips.length}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{principal.emailVerified ? 'Verified' : 'Email pending'}</dd>
        </div>
      </dl>
    </aside>
  )
}
