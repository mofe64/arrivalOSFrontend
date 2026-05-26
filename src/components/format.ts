import type { TimelineEventType, TripStatus } from '../api/types'

export function statusLabel(status: TripStatus) {
  const labels: Record<TripStatus, string> = {
    CREATED: 'Created',
    FLIGHT_APPROACHING: 'Flight approaching',
    CONCIERGE_IN_POSITION: 'Concierge in position',
    FLIGHT_LANDED: 'Flight landed',
    CLIENT_MET: 'Client met',
    PROCESSING: 'Processing',
    TERMINAL_EXITED: 'Terminal exited',
    HANDOVER_COMPLETED: 'Handover completed',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  }
  return labels[status]
}

export function eventLabel(eventType: TimelineEventType) {
  const labels: Record<TimelineEventType, string> = {
    TRIP_CREATED: 'Trip created',
    FLIGHT_APPROACHING: 'Flight approaching',
    CONCIERGE_IN_POSITION: 'Concierge in position',
    FLIGHT_LANDED: 'Flight landed',
    CLIENT_MET: 'Client met',
    CHECKPOINT_STARTED: 'Checkpoint started',
    CHECKPOINT_COMPLETED: 'Checkpoint completed',
    TERMINAL_EXITED: 'Terminal exited',
    HANDOVER_COMPLETED: 'Handover completed',
    TRIP_COMPLETED: 'Trip completed',
    TRIP_CANCELLED: 'Trip cancelled',
  }
  return labels[eventType]
}

export function shortDateTime(value?: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function relativeTime(value?: string | null) {
  if (!value) return 'No update yet'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.round(diff / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return shortDateTime(value)
}

export type StatusTone = 'scheduled' | 'active' | 'watch' | 'complete' | 'danger'

export function statusTone(status: TripStatus): StatusTone {
  switch (status) {
    case 'CREATED':
    case 'FLIGHT_APPROACHING':
      return 'scheduled'
    case 'CONCIERGE_IN_POSITION':
    case 'FLIGHT_LANDED':
    case 'CLIENT_MET':
    case 'PROCESSING':
      return 'active'
    case 'TERMINAL_EXITED':
    case 'HANDOVER_COMPLETED':
      return 'watch'
    case 'COMPLETED':
      return 'complete'
    case 'CANCELLED':
      return 'danger'
  }
}
