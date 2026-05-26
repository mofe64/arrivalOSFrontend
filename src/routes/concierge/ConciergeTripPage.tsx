import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { readAccessTokenFromUrl } from '../../api/accessToken'
import { conciergeApi } from '../../api/arrivalos'
import { withFixtureFallback } from '../../api/fallback'
import { ApiError } from '../../api/types'
import {
  enqueueAction,
  readQueue,
  removeQueuedAction,
  type QueuedConciergeAction,
} from '../../api/offlineQueue'
import { fixtureConciergeTripDetail } from '../../data/fixtures'
import {
  CheckpointTimeline,
  PrincipalIdentityBlock,
  TimelineFeed,
  TripStatusBand,
} from '../../components/ArrivalComponents'
import { ApiErrorMessage, LoadingState } from '../../components/Primitives'
import { shortDateTime } from '../../components/format'
import { isClosedStatus } from '../../components/tripFlow'

export function ConciergeTripPage() {
  const { tripId } = useParams({ from: '/concierge/trips/$tripId' })
  const search = useSearch({ strict: false }) as { token?: string }
  const accessToken = useAccessToken(search.token)
  const queryClient = useQueryClient()
  const [queue, setQueue] = useState<QueuedConciergeAction[]>(() => readQueue(tripId))
  const [note, setNote] = useState('')

  const tripQuery = useQuery({
    queryKey: ['concierge', 'trip', tripId, Boolean(accessToken)],
    enabled: Boolean(accessToken),
    queryFn: () =>
      withFixtureFallback(
        () => conciergeApi.trip(tripId, accessToken),
        { ...fixtureConciergeTripDetail, id: tripId },
      ),
  })
  const trip = tripQuery.data
  const nextAction = trip?.nextAllowedAction ?? null
  const closed = trip ? isClosedStatus(trip.status) : false

  const submitEvent = useMutation({
    mutationFn: async (action: {
      eventType: QueuedConciergeAction['eventType']
      checkpointName?: string
      idempotencyKey: string
    }) => {
      if (!trip) return null
      if (!navigator.onLine) {
        const queued = enqueueAction({
          tripId,
          accessToken,
          eventType: action.eventType,
          note: note || undefined,
          checkpointName: action.checkpointName,
          idempotencyKey: action.idempotencyKey,
        })
        setQueue(readQueue(tripId))
        return queued
      }
      return conciergeApi.addTimelineEvent(
        tripId,
        accessToken,
        action.eventType,
        note || undefined,
        action.checkpointName,
        undefined,
        action.idempotencyKey,
      )
    },
    onSuccess: () => {
      setNote('')
      void queryClient.invalidateQueries({ queryKey: ['concierge', 'trip', tripId] })
    },
    onError: (error, action) => {
      if (isClientError(error)) {
        return
      }
      enqueueAction({
        tripId,
        accessToken,
        eventType: action.eventType,
        note: note || undefined,
        checkpointName: action.checkpointName,
        idempotencyKey: action.idempotencyKey,
      })
      setQueue(readQueue(tripId))
    },
  })

  const syncQueued = useMemo(
    () => async () => {
      const queued = readQueue(tripId)
      for (const action of queued) {
        try {
          await conciergeApi.addTimelineEvent(
            action.tripId,
            action.accessToken,
            action.eventType,
            action.note,
            action.checkpointName,
            action.offlineCreatedAt,
            action.idempotencyKey,
          )
          removeQueuedAction(tripId, action.id)
        } catch (error) {
          if (isClientError(error)) {
            removeQueuedAction(tripId, action.id)
            continue
          }
          throw error
        }
      }
      setQueue(readQueue(tripId))
      void queryClient.invalidateQueries({ queryKey: ['concierge', 'trip', tripId] })
    },
    [queryClient, tripId],
  )

  useEffect(() => {
    function handleOnline() {
      void syncQueued().catch(() => setQueue(readQueue(tripId)))
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncQueued, tripId])

  if (!accessToken) {
    return (
      <main className="concierge-shell">
        <section className="ops-panel">
          <h1>Access token missing</h1>
          <p className="muted-copy">Open the access link sent to you by Gbèjà ops.</p>
        </section>
      </main>
    )
  }

  if (tripQuery.isLoading) return <main className="concierge-shell"><LoadingState /></main>

  if (!trip) {
    return (
      <main className="concierge-shell">
        <ApiErrorMessage error={tripQuery.error} />
      </main>
    )
  }

  return (
    <main className="concierge-shell">
      <TripStatusBand
        status={trip.status}
        principalName={trip.principals[0]?.fullName}
        flightNumber={trip.flightNumber}
        airport={trip.arrivalAirport}
        lastUpdatedAt={trip.lastUpdatedAt}
        currentCheckpoint={trip.currentCheckpoint}
      />

      <section className="concierge-command">
        <article className="principal-focus-panel">
          <PrincipalIdentityBlock principals={trip.principals} />
          <PrincipalContactRow principal={trip.principals[0]} />
          <div className="meeting-point">
            <p className="eyebrow">Meeting point</p>
            <h2>{trip.meetingPoint ?? 'Meeting point not set'}</h2>
            <p>{trip.arrivalAirport} {trip.arrivalTerminal ? `· ${trip.arrivalTerminal}` : ''} · {shortDateTime(trip.scheduledArrivalAt)}</p>
          </div>
          <div className="sync-strip" data-state={queue.length > 0 ? 'waiting' : 'synced'}>
            <strong>{queue.length > 0 ? `${queue.length} waiting to sync` : 'Synced'}</strong>
            <span>{navigator.onLine ? 'Online' : 'Offline'}</span>
            <span>{trip.watcherCount} {trip.watcherCount === 1 ? 'watcher' : 'watchers'}</span>
            {queue.length > 0 && navigator.onLine && (
              <button type="button" onClick={() => void syncQueued()}>Sync now</button>
            )}
          </div>
          <label className="field">
            <span>Field note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
          </label>
          <ApiErrorMessage error={submitEvent.error} />
          <button
            className="primary-button concierge-primary"
            disabled={!nextAction || closed || submitEvent.isPending}
            type="button"
            onClick={() => {
              if (!nextAction) return
              submitEvent.mutate({
                eventType: nextAction.eventType,
                checkpointName: nextAction.checkpointName ?? undefined,
                idempotencyKey: crypto.randomUUID(),
              })
            }}
          >
            {submitEvent.isPending ? 'Submitting...' : nextAction?.label ?? 'Trip closed'}
          </button>
        </article>

        <article className="ops-panel">
          <h2>Checkpoints</h2>
          <CheckpointTimeline checkpoints={trip.checkpoints} />
        </article>
      </section>

      <article className="timeline-panel">
        <div className="panel-heading"><h2>Timeline</h2></div>
        <TimelineFeed events={trip.timelineEvents} />
      </article>
    </main>
  )
}

function isClientError(error: unknown) {
  return error instanceof ApiError && error.status >= 400 && error.status < 500
}

function PrincipalContactRow({ principal }: { principal?: { fullName: string; phone?: string | null } }) {
  if (!principal?.phone) return null
  const sanitized = principal.phone.replace(/[^\d+]/g, '')
  return (
    <div className="principal-contact-row" aria-label={`Reach ${principal.fullName}`}>
      <a className="primary-button" href={`tel:${sanitized}`}>Call principal</a>
      <a className="secondary-button" href={`sms:${sanitized}`}>Send SMS</a>
    </div>
  )
}

function useAccessToken(queryToken?: string) {
  const [token, setToken] = useState(() => readAccessTokenFromUrl(queryToken))
  useEffect(() => {
    const handler = () => setToken(readAccessTokenFromUrl())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  return token
}
