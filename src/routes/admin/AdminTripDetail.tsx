import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { adminApi } from '../../api/arrivalos'
import { withFixtureFallback } from '../../api/fallback'
import type { AdminPrincipalSummary, Concierge, ConciergeAccessLink, TimelineEventType, TripPrincipal, TripStatus } from '../../api/types'
import { fixtureAdminTripDetail } from '../../data/fixtures'
import {
  CheckpointTimeline,
  ConciergeIdentityCard,
  NotificationRecipientList,
  PrincipalIdentityBlock,
  TimelineFeed,
  TripStatusBand,
} from '../../components/ArrivalComponents'
import { ApiErrorMessage, LoadingState } from '../../components/Primitives'
import { shortDateTime, statusLabel } from '../../components/format'
import { eventOptions, isClosedStatus, nextEventForStatus } from '../../components/tripFlow'
import { toFragmentLink } from '../../api/accessToken'
import { PrincipalLinkFields, type PrincipalEntryMode } from './PrincipalLinkFields'

export function AdminTripDetailPage() {
  const { tripId } = useParams({ from: '/admin/trips/$tripId' })
  const queryClient = useQueryClient()
  const tripQuery = useQuery({
    queryKey: ['admin', 'trip', tripId],
    queryFn: () => withFixtureFallback(() => adminApi.trip(tripId), { ...fixtureAdminTripDetail, id: tripId }),
  })
  const conciergesQuery = useQuery({
    queryKey: ['admin', 'concierges'],
    queryFn: adminApi.concierges,
  })
  const principalsQuery = useQuery({
    queryKey: ['admin', 'principals', 'trip-detail'],
    queryFn: adminApi.principals,
  })
  const trip = tripQuery.data
  const invalidateTrip = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'trip', tripId] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }

  const addEvent = useMutation({
    mutationFn: ({ eventType, note, checkpointName }: { eventType: TimelineEventType; note?: string; checkpointName?: string }) =>
      adminApi.addTimelineEvent(tripId, eventType, note, checkpointName),
    onSuccess: invalidateTrip,
  })
  const addWatcher = useMutation({
    mutationFn: (payload: { fullName: string; email: string }) => adminApi.addWatcher(tripId, { ...payload, notificationChannel: 'EMAIL' }),
    onSuccess: invalidateTrip,
  })
  const addPrincipal = useMutation({
    mutationFn: (payload: { fullName?: string; phone?: string; userAccountId?: string }) => adminApi.addPrincipal(tripId, payload),
    onSuccess: invalidateTrip,
  })
  const assign = useMutation({
    mutationFn: (conciergeId: string) => adminApi.assignConcierge(tripId, conciergeId),
    onSuccess: invalidateTrip,
  })
  const accessLink = useMutation({
    mutationFn: (conciergeId: string) => adminApi.createConciergeAccessLink(tripId, conciergeId),
  })
  const cancel = useMutation({
    mutationFn: (note: string) => adminApi.cancelTrip(tripId, note),
    onSuccess: invalidateTrip,
  })

  if (tripQuery.isLoading) return <LoadingState />
  if (!trip) return <ApiErrorMessage error={tripQuery.error} />

  const closed = isClosedStatus(trip.status)
  const linkedPrincipalAccountIds = new Set(
    trip.principals.map((principal) => principal.userAccountId).filter(Boolean),
  )
  const availablePrincipals = (principalsQuery.data ?? []).filter(
    (principal) => !linkedPrincipalAccountIds.has(principal.id),
  )

  return (
    <div className="detail-layout">
      <TripStatusBand
        status={trip.status}
        principalName={trip.principals[0]?.fullName}
        flightNumber={trip.flightNumber}
        airport={trip.arrivalAirport}
        lastUpdatedAt={trip.lastUpdatedAt}
        currentCheckpoint={trip.currentCheckpoint}
      />
      <ApiErrorMessage error={tripQuery.error} />

      <section className="detail-main">
        <article className="timeline-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Source of truth</p>
              <h2>Timeline feed</h2>
            </div>
            <span>{statusLabel(trip.status)}</span>
          </div>
          <TimelineFeed events={trip.timelineEvents} />
        </article>

        <aside className="side-stack">
          <ConciergeIdentityCard concierge={trip.concierge} />
          <InfoPanel title="Flight details">
            <dl className="compact-dl">
              <div><dt>Flight</dt><dd>{trip.flightNumber}</dd></div>
              <div><dt>Airport</dt><dd>{trip.arrivalAirport}</dd></div>
              <div><dt>Terminal</dt><dd>{trip.arrivalTerminal ?? 'Not set'}</dd></div>
              <div><dt>Meeting point</dt><dd>{trip.meetingPoint ?? 'Not set'}</dd></div>
              <div><dt>Scheduled</dt><dd>{shortDateTime(trip.scheduledArrivalAt)}</dd></div>
            </dl>
            {!trip.meetingPoint && <p className="warning-note">Meeting point is not set. Principal and concierge views will show fallback instructions.</p>}
          </InfoPanel>
          <InfoPanel title="Principals"><PrincipalIdentityBlock principals={trip.principals} /></InfoPanel>
          <InfoPanel title="Notification recipients"><NotificationRecipientList watchers={trip.watchers} /></InfoPanel>
        </aside>
      </section>

      <section className="detail-grid">
        <article className="ops-panel">
          <h2>Checkpoints</h2>
          <CheckpointTimeline checkpoints={trip.checkpoints} />
        </article>
        <AdminActions
          addEvent={(eventType, note, checkpointName) => addEvent.mutate({ eventType, note, checkpointName })}
          addEventPending={addEvent.isPending}
          addEventError={addEvent.error}
          addPrincipal={(payload) => addPrincipal.mutate(payload)}
          addPrincipalError={addPrincipal.error}
          availablePrincipals={availablePrincipals}
          principalDirectoryError={principalsQuery.error}
          principalDirectoryLoading={principalsQuery.isLoading}
          addWatcher={(payload) => addWatcher.mutate(payload)}
          addWatcherError={addWatcher.error}
          assignConcierge={(conciergeId) => assign.mutate(conciergeId)}
          assignError={assign.error}
          assignPending={assign.isPending}
          cancelTrip={(note) => cancel.mutate(note)}
          cancelError={cancel.error}
          cancelPending={cancel.isPending}
          conciergeId={trip.concierge?.id}
          flightNumber={trip.flightNumber}
          concierges={conciergesQuery.data ?? []}
          currentCheckpointName={trip.currentCheckpoint?.name}
          disabled={closed}
          issueAccessLink={(conciergeId) => accessLink.mutate(conciergeId)}
          issueAccessLinkError={accessLink.error}
          issueAccessLinkPending={accessLink.isPending}
          accessLink={accessLink.data}
          principals={trip.principals}
          tripStatus={trip.status}
        />
        <article className="ops-panel">
          <h2>Email notification attempts</h2>
          {trip.notificationAttempts.length === 0 ? (
            <p className="muted-copy">No email attempts recorded yet.</p>
          ) : (
            <ul className="attempt-list">
              {trip.notificationAttempts.map((attempt) => (
                <li key={attempt.id}>
                  <strong>{attempt.channel} · {attempt.status}</strong>
                  <span>{attempt.provider ?? 'provider pending'} · {shortDateTime(attempt.createdAt)}</span>
                  {attempt.failureReason && <small>{attempt.failureReason}</small>}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  )
}

function AdminActions({
  addEvent,
  addEventPending,
  addEventError,
  addPrincipal,
  addPrincipalError,
  availablePrincipals,
  principalDirectoryError,
  principalDirectoryLoading,
  addWatcher,
  addWatcherError,
  assignConcierge,
  assignError,
  assignPending,
  cancelTrip,
  cancelError,
  cancelPending,
  conciergeId,
  concierges,
  currentCheckpointName,
  disabled,
  flightNumber,
  issueAccessLink,
  issueAccessLinkError,
  issueAccessLinkPending,
  accessLink,
  principals,
  tripStatus,
}: {
  addEvent: (eventType: TimelineEventType, note?: string, checkpointName?: string) => void
  addEventPending: boolean
  addEventError: unknown
  addPrincipal: (payload: { fullName?: string; phone?: string; userAccountId?: string }) => void
  addPrincipalError: unknown
  availablePrincipals: AdminPrincipalSummary[]
  principalDirectoryError: unknown
  principalDirectoryLoading: boolean
  addWatcher: (payload: { fullName: string; email: string }) => void
  addWatcherError: unknown
  assignConcierge: (conciergeId: string) => void
  assignError: unknown
  assignPending: boolean
  cancelTrip: (note: string) => void
  cancelError: unknown
  cancelPending: boolean
  conciergeId?: string
  concierges: Concierge[]
  currentCheckpointName?: string
  disabled: boolean
  flightNumber: string
  issueAccessLink: (conciergeId: string) => void
  issueAccessLinkError: unknown
  issueAccessLinkPending: boolean
  accessLink?: ConciergeAccessLink
  principals: TripPrincipal[]
  tripStatus: TripStatus
}) {
  const suggestedEvent = nextEventForStatus(tripStatus)
  const [eventType, setEventType] = useState<TimelineEventType>(suggestedEvent?.eventType ?? 'CONCIERGE_IN_POSITION')
  const [checkpointName, setCheckpointName] = useState(currentCheckpointName ?? '')
  const [note, setNote] = useState('')
  const [principalMode, setPrincipalMode] = useState<PrincipalEntryMode>('existing')
  const [selectedPrincipalId, setSelectedPrincipalId] = useState('')
  const [principalName, setPrincipalName] = useState('')
  const [principalPhone, setPrincipalPhone] = useState('')
  const [watcherName, setWatcherName] = useState('')
  const [watcherEmail, setWatcherEmail] = useState('')
  const [watcherValidation, setWatcherValidation] = useState('')
  const [selectedConcierge, setSelectedConcierge] = useState(conciergeId ?? '')
  const selectedEvent = eventOptions.find((option) => option.eventType === eventType)
  const selectedConciergeValue = selectedConcierge || conciergeId || ''
  const assignedConcierge = conciergeId ? concierges.find((concierge) => concierge.id === conciergeId) : undefined
  const selectedConciergeRecord = selectedConciergeValue ? concierges.find((concierge) => concierge.id === selectedConciergeValue) : undefined
  const conciergeSelectionChanged = Boolean(selectedConciergeValue && selectedConciergeValue !== conciergeId)
  const canAssignConcierge = Boolean(selectedConciergeRecord?.active && conciergeSelectionChanged && !disabled && !assignPending)
  const canIssueAccessLink = Boolean(selectedConciergeRecord?.active && selectedConciergeValue === conciergeId && !disabled && !issueAccessLinkPending)
  const selectedPrincipalStillAvailable = availablePrincipals.some((principal) => principal.id === selectedPrincipalId)
  const effectiveSelectedPrincipalId = selectedPrincipalStillAvailable ? selectedPrincipalId : availablePrincipals[0]?.id ?? ''
  const canSubmitPrincipal = principalMode === 'existing' ? Boolean(effectiveSelectedPrincipalId) : Boolean(principalName.trim())

  function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedEvent?.checkpointRequired && !checkpointName.trim()) {
      return
    }
    addEvent(eventType, note || undefined, checkpointName || undefined)
    setNote('')
  }

  function submitWatcher() {
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watcherEmail.trim())
    if (!watcherName.trim() || !validEmail) {
      setWatcherValidation('Enter a recipient name and a valid email address.')
      return
    }
    setWatcherValidation('')
    addWatcher({ fullName: watcherName.trim(), email: watcherEmail.trim() })
  }

  function submitPrincipal() {
    if (principalMode === 'existing') {
      if (!effectiveSelectedPrincipalId) return
      addPrincipal({ userAccountId: effectiveSelectedPrincipalId })
      return
    }
    if (!principalName.trim()) return
    addPrincipal({ fullName: principalName.trim(), phone: principalPhone.trim() || undefined })
  }

  const safeAccessLink = accessLink ? toFragmentLink(accessLink.updateUrl) : ''

  async function copyAccessLink() {
    if (!safeAccessLink) return
    await navigator.clipboard.writeText(safeAccessLink)
  }

  return (
    <article className="ops-panel admin-command-panel">
      <div className="command-panel-heading">
        <div>
          <p className="eyebrow">Ops command</p>
          <h2>Next operational move</h2>
        </div>
        <span>{statusLabel(tripStatus)}</span>
      </div>
      {disabled && <p className="warning-note">This trip is closed. Operational mutations are disabled.</p>}
      <form className="stack-form timeline-action-form" onSubmit={submitEvent}>
        <ApiErrorMessage error={addEventError} />
        <label className="field">
          <span>Timeline event {suggestedEvent ? `(suggested: ${suggestedEvent.label})` : ''}</span>
          <select value={eventType} onChange={(event) => setEventType(event.target.value as TimelineEventType)}>
            {eventOptions.map((option) => (
              <option key={option.eventType} value={option.eventType}>{option.label}</option>
            ))}
          </select>
        </label>
        {selectedEvent?.checkpointRequired && (
          <label className="field"><span>Checkpoint name</span><input value={checkpointName} onChange={(event) => setCheckpointName(event.target.value)} /></label>
        )}
        <label className="field"><span>Ops note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <button className="primary-button" disabled={disabled || addEventPending || Boolean(selectedEvent?.checkpointRequired && !checkpointName.trim())} type="submit">Submit timeline event</button>
      </form>

      <section className="principal-command-section">
        <div className="subsection-heading">
          <div>
            <p className="eyebrow">Principal record</p>
            <h3>People on this trip</h3>
          </div>
          <span>{principals.length} listed</span>
        </div>
        <TripPrincipalRoster principals={principals} />
        <details className="command-disclosure">
          <summary>Add or link another principal</summary>
          <div className="command-disclosure-body">
            <ApiErrorMessage error={addPrincipalError} />
            <PrincipalLinkFields
              availablePrincipals={availablePrincipals}
              disabled={disabled}
              error={principalDirectoryError}
              loading={principalDirectoryLoading}
              manualName={principalName}
              manualPhone={principalPhone}
              mode={principalMode}
              onManualNameChange={setPrincipalName}
              onManualPhoneChange={setPrincipalPhone}
              onModeChange={setPrincipalMode}
              onSelectedPrincipalIdChange={setSelectedPrincipalId}
              selectedPrincipalId={effectiveSelectedPrincipalId}
            />
            <button
              className="secondary-button"
              disabled={disabled || !canSubmitPrincipal}
              type="button"
              onClick={submitPrincipal}
            >
              {principalMode === 'existing' ? 'Link principal account' : 'Add manual principal'}
            </button>
          </div>
        </details>
      </section>

      <section className="concierge-command-section">
        <div className="subsection-heading">
          <div>
            <p className="eyebrow">Concierge assignment</p>
            <h3>{assignedConcierge ? 'Field operator assigned' : 'Assign field operator'}</h3>
          </div>
          <span>{assignedConcierge?.publicId ?? 'Unassigned'}</span>
        </div>
        <ApiErrorMessage error={assignError} />
        <ApiErrorMessage error={issueAccessLinkError} />
        <div className="concierge-assignment-grid">
          <label className="field">
            <span>Operator record</span>
            <select aria-label="Assign concierge" value={selectedConciergeValue} onChange={(event) => setSelectedConcierge(event.target.value)}>
              <option value="">Select concierge</option>
              {concierges.map((concierge) => <option key={concierge.id} value={concierge.id}>{concierge.fullName} · {concierge.publicId}{concierge.active ? '' : ' · inactive'}</option>)}
            </select>
          </label>
          <ConciergeSelectionPreview
            assigned={selectedConciergeValue === conciergeId}
            concierge={selectedConciergeRecord}
          />
        </div>
        <div className="command-button-row">
          <button disabled={!canAssignConcierge} type="button" onClick={() => assignConcierge(selectedConciergeValue)}>
            {assignPending ? 'Assigning...' : assignedConcierge ? 'Change assignment' : 'Assign concierge'}
          </button>
          <button disabled={!canIssueAccessLink} type="button" onClick={() => issueAccessLink(selectedConciergeValue)}>
            {issueAccessLinkPending ? 'Issuing...' : 'Issue access link'}
          </button>
        </div>
        {selectedConciergeRecord && !selectedConciergeRecord.active && <p className="warning-note">Inactive concierges cannot be assigned to live trips.</p>}
        {selectedConciergeValue && selectedConciergeValue !== conciergeId && <p className="muted-copy">Assign this concierge before issuing a trip-scoped access link.</p>}
      </section>

      <section className="watcher-command-section">
        <div className="subsection-heading">
          <div>
            <p className="eyebrow">Notification recipient</p>
            <h3>Add email watcher</h3>
          </div>
        </div>
        <div className="inline-form">
          <ApiErrorMessage error={addWatcherError} />
          {watcherValidation && <p className="warning-note">{watcherValidation}</p>}
          <input aria-label="Watcher name" placeholder="Recipient name" value={watcherName} onChange={(event) => setWatcherName(event.target.value)} />
          <input aria-label="Watcher email" placeholder="Email address" type="email" value={watcherEmail} onChange={(event) => setWatcherEmail(event.target.value)} />
          <button disabled={disabled} type="button" onClick={submitWatcher}>Add email recipient</button>
        </div>
      </section>
      {accessLink && (
        <div className="access-link-panel">
          <p className="eyebrow">Concierge access link</p>
          <a href={safeAccessLink}>{safeAccessLink}</a>
          <small>Expires {shortDateTime(accessLink.expiresAt)}</small>
          <button className="secondary-button" type="button" onClick={copyAccessLink}>Copy link</button>
        </div>
      )}
      <ApiErrorMessage error={cancelError} />
      <CancelTripDialog
        disabled={disabled}
        flightNumber={flightNumber}
        onConfirm={cancelTrip}
        pending={cancelPending}
      />
    </article>
  )
}

function CancelTripDialog({
  disabled,
  flightNumber,
  onConfirm,
  pending,
}: {
  disabled: boolean
  flightNumber: string
  onConfirm: (note: string) => void
  pending: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [reason, setReason] = useState('')
  const expected = flightNumber.trim()
  const matches = confirmText.trim().toUpperCase() === expected.toUpperCase()
  const ready = matches && reason.trim().length > 0 && !pending

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function close() {
    setOpen(false)
    setConfirmText('')
    setReason('')
  }

  return (
    <>
      <button
        className="danger-button"
        disabled={disabled}
        type="button"
        onClick={() => setOpen(true)}
      >
        Cancel trip…
      </button>
      <dialog
        aria-labelledby="cancel-trip-title"
        className="confirm-dialog"
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClose={() => setOpen(false)}
      >
        <form method="dialog" onSubmit={(event) => event.preventDefault()}>
          <p className="eyebrow">Destructive action</p>
          <h2 id="cancel-trip-title">Cancel trip {expected}</h2>
          <p className="muted-copy">
            This closes the timeline, revokes the concierge access link, and notifies watchers.
            It cannot be undone from this screen.
          </p>
          <label className="field">
            <span>Type the flight number to confirm</span>
            <input
              autoComplete="off"
              autoFocus
              placeholder={expected}
              spellCheck={false}
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Reason (recorded on the timeline)</span>
            <textarea
              placeholder="e.g. Flight diverted to ABV; principal rerouting."
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="confirm-dialog-actions">
            <button className="secondary-button" type="button" onClick={close}>Keep trip open</button>
            <button
              className="danger-button"
              disabled={!ready}
              type="button"
              onClick={() => {
                onConfirm(reason.trim())
                close()
              }}
            >
              {pending ? 'Cancelling…' : 'Cancel trip'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}

function TripPrincipalRoster({ principals }: { principals: TripPrincipal[] }) {
  if (principals.length === 0) {
    return <p className="muted-copy">No principal has been added to this trip.</p>
  }

  return (
    <ul className="trip-principal-roster">
      {principals.map((principal) => (
        <li key={principal.id}>
          <span className="operator-avatar" aria-hidden="true">{initials(principal.fullName)}</span>
          <div>
            <strong>{principal.fullName}</strong>
            <small>
              {principal.primaryContact ? 'Primary contact' : 'Additional principal'}
              {' · '}
              {principal.userAccountId ? 'Linked account' : 'Manual trip record'}
              {principal.phone ? ` · ${principal.phone}` : ''}
            </small>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ConciergeSelectionPreview({ assigned, concierge }: { assigned: boolean; concierge?: Concierge }) {
  if (!concierge) {
    return (
      <div className="concierge-selection-preview" data-empty="true">
        <strong>No concierge selected</strong>
        <span>Choose an active field operator, then assign them to this arrival.</span>
      </div>
    )
  }

  return (
    <div className="concierge-selection-preview">
      <span className="operator-avatar" aria-hidden="true">{initials(concierge.fullName)}</span>
      <div>
        <strong>{concierge.fullName}</strong>
        <small>{concierge.publicId} · {concierge.phone}</small>
      </div>
      <mark data-status={assigned ? 'assigned' : concierge.active ? 'ready' : 'inactive'}>
        {assigned ? 'Assigned' : concierge.active ? 'Ready' : 'Inactive'}
      </mark>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="info-panel">
      <h2>{title}</h2>
      {children}
    </article>
  )
}
