import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { adminApi } from '../../api/arrivalos'
import { withFixtureFallback } from '../../api/fallback'
import type { AdminPrincipalSummary, AdminTripDetail, Concierge, ConciergeAccessLink, TimelineEvent, TimelineEventType, TripPrincipal, TripStatus, Watcher } from '../../api/types'
import { fixtureAdminTripDetail } from '../../data/fixtures'
import {
  CheckpointTimeline,
  ConciergeIdentityCard,
  NotificationRecipientList,
  TimelineFeed,
  TripStatusBand,
} from '../../components/ArrivalComponents'
import { ApiErrorMessage, LoadingState } from '../../components/Primitives'
import { shortDateTime, statusLabel } from '../../components/format'
import { eventOptions, isClosedStatus, nextEventForStatus } from '../../components/tripFlow'
import { toFragmentLink } from '../../api/accessToken'
import { useToast } from '../../components/toastContext'
import { PrincipalLinkFields, type PrincipalEntryMode } from './PrincipalLinkFields'

export function AdminTripDetailPage() {
  const { tripId } = useParams({ from: '/admin/trips/$tripId' })
  const queryClient = useQueryClient()
  const toast = useToast()
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
    void queryClient.invalidateQueries({ queryKey: ['admin', 'trips'] })
  }

  const tripKey = ['admin', 'trip', tripId]
  const addEvent = useMutation({
    mutationFn: ({ eventType, note, checkpointName }: { eventType: TimelineEventType; note?: string; checkpointName?: string }) =>
      adminApi.addTimelineEvent(tripId, eventType, note, checkpointName),
    onMutate: async ({ eventType, note, checkpointName }) => {
      await queryClient.cancelQueries({ queryKey: tripKey })
      const previous = queryClient.getQueryData<AdminTripDetail>(tripKey)
      if (previous) {
        const optimisticEvent: TimelineEvent = {
          id: `optimistic-${crypto.randomUUID()}`,
          eventType,
          actorType: 'OPS',
          note,
          checkpointName: checkpointName ?? null,
          occurredAt: new Date().toISOString(),
        }
        queryClient.setQueryData<AdminTripDetail>(tripKey, {
          ...previous,
          timelineEvents: [...previous.timelineEvents, optimisticEvent],
          lastUpdatedAt: optimisticEvent.occurredAt,
        })
      }
      return { previous }
    },
    onSuccess: (response) => {
      invalidateTrip()
      if (!response?.duplicate) toast.pushSuccess('Timeline updated')
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(tripKey, context.previous)
      toast.pushError('Could not record timeline event', error)
    },
  })
  const addWatcher = useMutation({
    mutationFn: (payload: { fullName: string; email: string }) => adminApi.addWatcher(tripId, { ...payload, notificationChannel: 'EMAIL' }),
    onSuccess: (watcher) => {
      invalidateTrip()
      toast.pushSuccess('Watcher added', `${watcher.fullName} will receive email updates.`)
    },
    onError: (error) => toast.pushError('Could not add watcher', error),
  })
  const addPrincipal = useMutation({
    mutationFn: (payload: { fullName?: string; phone?: string; userAccountId?: string }) => adminApi.addPrincipal(tripId, payload),
    onSuccess: () => {
      invalidateTrip()
      toast.pushSuccess('Principal linked to trip')
    },
    onError: (error) => toast.pushError('Could not link principal', error),
  })
  const assign = useMutation({
    mutationFn: (conciergeId: string) => adminApi.assignConcierge(tripId, conciergeId),
    onSuccess: () => {
      invalidateTrip()
      toast.pushSuccess('Concierge assigned')
    },
    onError: (error) => toast.pushError('Could not assign concierge', error),
  })
  const accessLink = useMutation({
    mutationFn: (conciergeId: string) => adminApi.createConciergeAccessLink(tripId, conciergeId),
    onSuccess: () => toast.pushSuccess('Access link issued', 'Copy the link to share with the concierge.'),
    onError: (error) => toast.pushError('Could not issue access link', error),
  })
  const cancel = useMutation({
    mutationFn: (note: string) => adminApi.cancelTrip(tripId, note),
    onSuccess: () => {
      invalidateTrip()
      toast.pushSuccess('Trip cancelled', 'The timeline is closed and watchers have been notified.')
    },
    onError: (error) => toast.pushError('Could not cancel trip', error),
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
            <h2>Timeline</h2>
            <span>{statusLabel(trip.status)}</span>
          </div>
          <TimelineFeed events={trip.timelineEvents} />
        </article>

        <aside className="side-stack">
          <ConciergeAdminPanel
            accessLink={accessLink.data}
            accessLinkPending={accessLink.isPending}
            assignedConcierge={trip.concierge}
            assignedConciergeId={trip.concierge?.id}
            assignPending={assign.isPending}
            concierges={conciergesQuery.data ?? []}
            disabled={closed}
            onAssign={(conciergeId) => assign.mutate(conciergeId)}
            onIssueLink={(conciergeId) => accessLink.mutate(conciergeId)}
          />
          <InfoPanel title="Flight details">
            <dl className="compact-dl">
              <div><dt>Flight</dt><dd>{trip.flightNumber}</dd></div>
              <div><dt>Airport</dt><dd>{trip.arrivalAirport}</dd></div>
              <div><dt>Terminal</dt><dd>{trip.arrivalTerminal ?? 'Not set'}</dd></div>
              <div><dt>Meeting point</dt><dd>{trip.meetingPoint ?? 'Not set'}</dd></div>
              <div><dt>Scheduled</dt><dd>{shortDateTime(trip.scheduledArrivalAt)}</dd></div>
            </dl>
            {!trip.meetingPoint && <p className="warning-note">Meeting point isn't set. Principal and concierge views will show fallback instructions.</p>}
          </InfoPanel>
          <PrincipalsAdminPanel
            availablePrincipals={availablePrincipals}
            disabled={closed}
            directoryError={principalsQuery.error}
            directoryLoading={principalsQuery.isLoading}
            onAdd={(payload) => addPrincipal.mutate(payload)}
            principals={trip.principals}
          />
          <WatchersAdminPanel
            disabled={closed}
            onAdd={(payload) => addWatcher.mutate(payload)}
            watchers={trip.watchers}
          />
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
          cancelTrip={(note) => cancel.mutate(note)}
          cancelPending={cancel.isPending}
          currentCheckpointName={trip.currentCheckpoint?.name}
          disabled={closed}
          flightNumber={trip.flightNumber}
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
  cancelTrip,
  cancelPending,
  currentCheckpointName,
  disabled,
  flightNumber,
  tripStatus,
}: {
  addEvent: (eventType: TimelineEventType, note?: string, checkpointName?: string) => void
  addEventPending: boolean
  cancelTrip: (note: string) => void
  cancelPending: boolean
  currentCheckpointName?: string
  disabled: boolean
  flightNumber: string
  tripStatus: TripStatus
}) {
  const suggestedEvent = nextEventForStatus(tripStatus)
  const [eventType, setEventType] = useState<TimelineEventType>(suggestedEvent?.eventType ?? 'CONCIERGE_IN_POSITION')
  const [checkpointName, setCheckpointName] = useState(currentCheckpointName ?? '')
  const [note, setNote] = useState('')
  const selectedEvent = eventOptions.find((option) => option.eventType === eventType)

  function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedEvent?.checkpointRequired && !checkpointName.trim()) return
    addEvent(eventType, note || undefined, checkpointName || undefined)
    setNote('')
  }

  return (
    <article className="ops-panel admin-actions">
      <div className="panel-heading">
        <h2>Next move</h2>
        <span>{statusLabel(tripStatus)}</span>
      </div>
      {disabled && <p className="warning-note">This trip is closed. Edits are disabled.</p>}
      <form className="stack-form" onSubmit={submitEvent}>
        <label className="field">
          <span>Event{suggestedEvent ? ` — suggested: ${suggestedEvent.label}` : ''}</span>
          <select value={eventType} onChange={(event) => setEventType(event.target.value as TimelineEventType)}>
            {eventOptions.map((option) => (
              <option key={option.eventType} value={option.eventType}>{option.label}</option>
            ))}
          </select>
        </label>
        {selectedEvent?.checkpointRequired && (
          <label className="field"><span>Checkpoint</span><input value={checkpointName} onChange={(event) => setCheckpointName(event.target.value)} /></label>
        )}
        <label className="field"><span>Note (optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <button className="primary-button" disabled={disabled || addEventPending || Boolean(selectedEvent?.checkpointRequired && !checkpointName.trim())} type="submit">
          {addEventPending ? 'Submitting…' : 'Submit event'}
        </button>
      </form>
      <CancelTripDialog
        disabled={disabled}
        flightNumber={flightNumber}
        onConfirm={cancelTrip}
        pending={cancelPending}
      />
    </article>
  )
}

function ConciergeAdminPanel({
  accessLink,
  accessLinkPending,
  assignedConcierge,
  assignedConciergeId,
  assignPending,
  concierges,
  disabled,
  onAssign,
  onIssueLink,
}: {
  accessLink?: ConciergeAccessLink
  accessLinkPending: boolean
  assignedConcierge?: Concierge | null
  assignedConciergeId?: string
  assignPending: boolean
  concierges: Concierge[]
  disabled: boolean
  onAssign: (conciergeId: string) => void
  onIssueLink: (conciergeId: string) => void
}) {
  const [selected, setSelected] = useState(assignedConciergeId ?? '')
  const selectedValue = selected || assignedConciergeId || ''
  const selectedRecord = selectedValue ? concierges.find((concierge) => concierge.id === selectedValue) : undefined
  const selectionChanged = Boolean(selectedValue && selectedValue !== assignedConciergeId)
  const canAssign = Boolean(selectedRecord?.active && selectionChanged && !disabled && !assignPending)
  const canIssueLink = Boolean(selectedRecord?.active && selectedValue === assignedConciergeId && !disabled && !accessLinkPending)
  const safeAccessLink = accessLink ? toFragmentLink(accessLink.updateUrl) : ''

  async function copyAccessLink() {
    if (!safeAccessLink) return
    await navigator.clipboard.writeText(safeAccessLink)
  }

  return (
    <article className="info-panel">
      <ConciergeIdentityCard concierge={assignedConcierge ?? null} />
      <label className="field">
        <span>Assignment</span>
        <select aria-label="Assign concierge" value={selectedValue} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Select concierge</option>
          {concierges.map((concierge) => (
            <option key={concierge.id} value={concierge.id}>
              {concierge.fullName} · {concierge.publicId}{concierge.active ? '' : ' · inactive'}
            </option>
          ))}
        </select>
      </label>
      <div className="command-button-row">
        <button disabled={!canAssign} type="button" onClick={() => onAssign(selectedValue)}>
          {assignPending ? 'Assigning…' : assignedConcierge ? 'Reassign' : 'Assign'}
        </button>
        <button disabled={!canIssueLink} type="button" onClick={() => onIssueLink(selectedValue)}>
          {accessLinkPending ? 'Issuing…' : 'Issue access link'}
        </button>
      </div>
      {selectedRecord && !selectedRecord.active && <p className="warning-note">Inactive concierges can't be assigned.</p>}
      {selectionChanged && <p className="muted-copy">Assign first, then issue the link.</p>}
      {accessLink && (
        <div className="access-link-panel">
          <strong>Access link issued</strong>
          <a href={safeAccessLink}>{safeAccessLink}</a>
          <small>Expires {shortDateTime(accessLink.expiresAt)}</small>
          <button className="secondary-button" type="button" onClick={copyAccessLink}>Copy link</button>
        </div>
      )}
    </article>
  )
}

function PrincipalsAdminPanel({
  availablePrincipals,
  directoryError,
  directoryLoading,
  disabled,
  onAdd,
  principals,
}: {
  availablePrincipals: AdminPrincipalSummary[]
  directoryError: unknown
  directoryLoading: boolean
  disabled: boolean
  onAdd: (payload: { fullName?: string; phone?: string; userAccountId?: string }) => void
  principals: TripPrincipal[]
}) {
  const [mode, setMode] = useState<PrincipalEntryMode>('existing')
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const stillAvailable = availablePrincipals.some((principal) => principal.id === selectedId)
  const effectiveId = stillAvailable ? selectedId : availablePrincipals[0]?.id ?? ''
  const canSubmit = mode === 'existing' ? Boolean(effectiveId) : Boolean(name.trim())

  function submit() {
    if (mode === 'existing') {
      if (!effectiveId) return
      onAdd({ userAccountId: effectiveId })
    } else if (name.trim()) {
      onAdd({ fullName: name.trim(), phone: phone.trim() || undefined })
    }
  }

  return (
    <article className="info-panel">
      <div className="panel-heading">
        <h2>Principals</h2>
        <span className="muted-copy">{principals.length}</span>
      </div>
      <TripPrincipalRoster principals={principals} />
      <details className="command-disclosure">
        <summary>Add or link a principal</summary>
        <div className="command-disclosure-body">
          <PrincipalLinkFields
            availablePrincipals={availablePrincipals}
            disabled={disabled}
            error={directoryError}
            loading={directoryLoading}
            manualName={name}
            manualPhone={phone}
            mode={mode}
            onManualNameChange={setName}
            onManualPhoneChange={setPhone}
            onModeChange={setMode}
            onSelectedPrincipalIdChange={setSelectedId}
            selectedPrincipalId={effectiveId}
          />
          <button
            className="secondary-button"
            disabled={disabled || !canSubmit}
            type="button"
            onClick={submit}
          >
            {mode === 'existing' ? 'Link account' : 'Add principal'}
          </button>
        </div>
      </details>
    </article>
  )
}

function WatchersAdminPanel({
  disabled,
  onAdd,
  watchers,
}: {
  disabled: boolean
  onAdd: (payload: { fullName: string; email: string }) => void
  watchers: Watcher[]
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [validation, setValidation] = useState('')

  function submit() {
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    if (!name.trim() || !validEmail) {
      setValidation('Enter a name and a valid email.')
      return
    }
    setValidation('')
    onAdd({ fullName: name.trim(), email: email.trim() })
    setName('')
    setEmail('')
  }

  return (
    <article className="info-panel">
      <div className="panel-heading">
        <h2>Watchers</h2>
        <span className="muted-copy">{watchers.length}</span>
      </div>
      <NotificationRecipientList watchers={watchers} />
      <details className="command-disclosure">
        <summary>Add a watcher</summary>
        <div className="command-disclosure-body">
          {validation && <p className="warning-note">{validation}</p>}
          <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <button
            className="secondary-button"
            disabled={disabled || !name.trim() || !email.trim()}
            type="button"
            onClick={submit}
          >
            Add watcher
          </button>
        </div>
      </details>
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
    return <p className="muted-copy">No principal yet — add one below.</p>
  }

  return (
    <ul className="trip-principal-roster">
      {principals.map((principal) => (
        <li key={principal.id}>
          <span className="operator-avatar" aria-hidden="true">{initials(principal.fullName)}</span>
          <div>
            <strong>{principal.fullName}</strong>
            <small>
              {principal.primaryContact ? 'Primary' : 'Additional'}
              {' · '}
              {principal.userAccountId ? 'Linked account' : 'Manual entry'}
              {principal.phone ? ` · ${principal.phone}` : ''}
            </small>
          </div>
        </li>
      ))}
    </ul>
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
