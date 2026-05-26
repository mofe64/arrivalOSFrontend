import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { adminApi } from '../../api/arrivalos'
import { defaultCheckpoints } from '../../data/fixtures'
import { ApiErrorMessage, SectionHeader } from '../../components/Primitives'
import { PrincipalLinkFields, type PrincipalEntryMode } from './PrincipalLinkFields'

type Step = 'details' | 'principals' | 'recipients' | 'operations'

const STEP_ORDER: Step[] = ['details', 'principals', 'recipients', 'operations']
const STEP_LABELS: Record<Step, string> = {
  details: 'Flight details',
  principals: 'Principals',
  recipients: 'Watchers',
  operations: 'Operations',
}

export function AdminTripCreatePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('details')
  const [flightNumber, setFlightNumber] = useState('')
  const [arrivalAirport, setArrivalAirport] = useState('')
  const [arrivalTerminal, setArrivalTerminal] = useState('')
  const [meetingPoint, setMeetingPoint] = useState('')
  const [scheduledArrivalAt, setScheduledArrivalAt] = useState('')
  const [principalMode, setPrincipalMode] = useState<PrincipalEntryMode>('existing')
  const [selectedPrincipalId, setSelectedPrincipalId] = useState('')
  const [principalName, setPrincipalName] = useState('')
  const [principalPhone, setPrincipalPhone] = useState('')
  const [watcherName, setWatcherName] = useState('')
  const [watcherEmail, setWatcherEmail] = useState('')
  const [conciergeId, setConciergeId] = useState('')
  const [checkpoints, setCheckpoints] = useState(defaultCheckpoints.map((checkpoint) => checkpoint.name).join('\n'))
  const principalsQuery = useQuery({
    queryKey: ['admin', 'principals', 'trip-create'],
    queryFn: adminApi.principals,
  })
  const conciergesQuery = useQuery({
    queryKey: ['admin', 'concierges', 'trip-create'],
    queryFn: adminApi.concierges,
  })
  const principals = principalsQuery.data ?? []
  const selectedPrincipalStillAvailable = principals.some((principal) => principal.id === selectedPrincipalId)
  const effectiveSelectedPrincipalId = selectedPrincipalStillAvailable ? selectedPrincipalId : principals[0]?.id ?? ''
  const selectedConcierge = (conciergesQuery.data ?? []).find((concierge) => concierge.id === conciergeId)
  const principalReady = principalMode === 'existing' ? Boolean(effectiveSelectedPrincipalId) : Boolean(principalName.trim())

  const stepErrors: Record<Step, string[]> = {
    details: [
      ...(flightNumber.trim() ? [] : ['Flight number is required.']),
      ...(arrivalAirport.trim() ? [] : ['Arrival airport is required.']),
    ],
    principals: principalReady
      ? []
      : [principalMode === 'existing'
          ? 'Select a principal account or switch to manual details.'
          : 'Principal name is required.'],
    recipients: watcherEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watcherEmail.trim())
      ? ['Watcher email is not a valid address.']
      : [],
    operations: [],
  }
  const stepIsValid = (target: Step) => stepErrors[target].length === 0
  const canSubmit = STEP_ORDER.every(stepIsValid) && !createTrip.isPending
  const farthestReachable: Step = STEP_ORDER.reduce<Step>((acc, target, idx) => {
    if (idx === 0) return target
    const previous = STEP_ORDER[idx - 1]
    return stepIsValid(previous) ? target : acc
  }, 'details')
  const isAtFirst = step === STEP_ORDER[0]
  const isAtLast = step === STEP_ORDER[STEP_ORDER.length - 1]

  const createTrip = useMutation({
    mutationFn: () => adminApi.createTrip({
      flightNumber: flightNumber.trim(),
      arrivalAirport: arrivalAirport.trim(),
      arrivalTerminal: arrivalTerminal.trim() || undefined,
      meetingPoint: meetingPoint.trim() || undefined,
      scheduledArrivalAt: scheduledArrivalAt ? new Date(scheduledArrivalAt).toISOString() : undefined,
      principals: [
        principalMode === 'existing' && effectiveSelectedPrincipalId
          ? { userAccountId: effectiveSelectedPrincipalId, primaryContact: true }
          : { fullName: principalName.trim(), phone: principalPhone.trim() || undefined, primaryContact: true },
      ],
      watchers: watcherEmail ? [{ fullName: watcherName.trim() || watcherEmail.trim(), email: watcherEmail.trim() }] : [],
      assignedConciergeId: conciergeId || undefined,
      checkpoints: checkpoints.split('\n').map((name) => name.trim()).filter(Boolean).map((name) => ({ name })),
    }),
    onSuccess: (trip) => void navigate({ to: '/admin/trips/$tripId', params: { tripId: trip.id } }),
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  function handleCreateTrip() {
    createTrip.mutate()
  }

  return (
    <>
      <SectionHeader eyebrow="New trip" title="Create arrival workflow" />
      <form className="wizard-shell" onSubmit={handleSubmit}>
        <ApiErrorMessage error={createTrip.error} />
        <nav className="wizard-steps" aria-label="Trip creation steps">
          {STEP_ORDER.map((item, index) => {
            const reachable = STEP_ORDER.indexOf(item) <= STEP_ORDER.indexOf(farthestReachable)
            return (
              <button
                aria-current={step === item ? 'step' : undefined}
                className={step === item ? 'active' : ''}
                disabled={!reachable}
                key={item}
                onClick={() => reachable && setStep(item)}
                type="button"
              >
                <small>Step {index + 1}</small> {STEP_LABELS[item]}
              </button>
            )
          })}
        </nav>

        {stepErrors[step].length > 0 && (
          <p className="warning-note" role="alert">{stepErrors[step].join(' ')}</p>
        )}

        {step === 'details' && (
          <section className="form-grid">
            <label className="field"><span>Flight number</span><input value={flightNumber} onChange={(event) => setFlightNumber(event.target.value)} /></label>
            <label className="field"><span>Arrival airport</span><input value={arrivalAirport} onChange={(event) => setArrivalAirport(event.target.value)} placeholder="LOS" /></label>
            <label className="field"><span>Arrival terminal</span><input value={arrivalTerminal} onChange={(event) => setArrivalTerminal(event.target.value)} /></label>
            <label className="field"><span>Scheduled arrival time</span><input type="datetime-local" value={scheduledArrivalAt} onChange={(event) => setScheduledArrivalAt(event.target.value)} /></label>
            <label className="field full-span"><span>Meeting point</span><input value={meetingPoint} onChange={(event) => setMeetingPoint(event.target.value)} placeholder="Arrivals hall, left of the currency exchange desk" /></label>
          </section>
        )}
        {step === 'principals' && (
          <section className="form-grid">
            <PrincipalLinkFields
              availablePrincipals={principals}
              error={principalsQuery.error}
              loading={principalsQuery.isLoading}
              manualName={principalName}
              manualPhone={principalPhone}
              mode={principalMode}
              onManualNameChange={setPrincipalName}
              onManualPhoneChange={setPrincipalPhone}
              onModeChange={setPrincipalMode}
              onSelectedPrincipalIdChange={setSelectedPrincipalId}
              selectedPrincipalId={effectiveSelectedPrincipalId}
            />
            <p className="form-hint full-span">Linked accounts keep the principal portal, watcher visibility, and trip history tied to one trusted identity.</p>
          </section>
        )}
        {step === 'recipients' && (
          <section className="form-grid">
            <label className="field"><span>Email recipient name</span><input value={watcherName} onChange={(event) => setWatcherName(event.target.value)} /></label>
            <label className="field"><span>Email recipient address</span><input type="email" value={watcherEmail} onChange={(event) => setWatcherEmail(event.target.value)} /></label>
            <p className="form-hint">Watchers are trip-scoped notification recipients, not login accounts.</p>
          </section>
        )}
        {step === 'operations' && (
          <section className="form-grid">
            <div className="full-span"><ApiErrorMessage error={conciergesQuery.error} /></div>
            <label className="field"><span>Linked concierge record</span><select value={conciergeId} onChange={(event) => setConciergeId(event.target.value)}><option value="">Assign later</option>{(conciergesQuery.data ?? []).map((concierge) => <option key={concierge.id} value={concierge.id}>{concierge.fullName} · {concierge.publicId}</option>)}</select></label>
            {selectedConcierge && (
              <aside className="principal-account-preview">
                <p className="eyebrow">Operator record</p>
                <strong>{selectedConcierge.fullName}</strong>
                <dl>
                  <div><dt>Public ID</dt><dd>{selectedConcierge.publicId}</dd></div>
                  <div><dt>Phone</dt><dd>{selectedConcierge.phone}</dd></div>
                  <div><dt>Status</dt><dd>{selectedConcierge.active ? 'Active' : 'Inactive'}</dd></div>
                </dl>
              </aside>
            )}
            <label className="field full-span"><span>Default checkpoint list</span><textarea rows={8} value={checkpoints} onChange={(event) => setCheckpoints(event.target.value)} /></label>
          </section>
        )}

        <div className="wizard-actions">
          <button
            className="secondary-button"
            disabled={isAtFirst}
            type="button"
            onClick={() => setStep(previousStep(step))}
          >
            Back
          </button>
          {isAtLast ? (
            <button className="primary-button" disabled={!canSubmit} type="button" onClick={handleCreateTrip}>
              {createTrip.isPending ? 'Creating…' : 'Create trip'}
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={!stepIsValid(step)}
              type="button"
              onClick={() => setStep(nextStep(step))}
            >
              Continue
            </button>
          )}
        </div>
      </form>
    </>
  )
}

function nextStep(step: Step): Step {
  if (step === 'details') return 'principals'
  if (step === 'principals') return 'recipients'
  return 'operations'
}

function previousStep(step: Step): Step {
  if (step === 'operations') return 'recipients'
  if (step === 'recipients') return 'principals'
  return 'details'
}
