import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { adminApi } from '../../api/arrivalos'
import { ApiErrorMessage, EmptyState, LoadingState, SectionHeader } from '../../components/Primitives'

export function AdminConciergesPage() {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [publicId, setPublicId] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const conciergesQuery = useQuery({
    queryKey: ['admin', 'concierges'],
    queryFn: adminApi.concierges,
  })
  const concierges = conciergesQuery.data ?? []
  const activeCount = concierges.filter((concierge) => concierge.active).length
  const create = useMutation({
    mutationFn: () =>
      adminApi.createConcierge({
        fullName: fullName.trim(),
        phone: phone.trim(),
        publicId: publicId.trim(),
        photoUrl: photoUrl.trim() || undefined,
      }),
    onSuccess: () => {
      setFullName('')
      setPhone('')
      setPublicId('')
      setPhotoUrl('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'concierges'] })
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <>
      <SectionHeader title="Concierges">
        <div className="section-kpis" aria-label="Concierge counts">
          <span>{activeCount} active</span>
          <span>{concierges.length} total</span>
        </div>
      </SectionHeader>
      <section className="concierge-admin-grid">
        <form className="ops-panel stack-form concierge-create-panel" onSubmit={handleSubmit}>
          <h2>Add concierge</h2>
          <p className="muted-copy">Access links are issued from each trip detail page.</p>
          <ApiErrorMessage error={create.error} />
          <label className="field"><span>Full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label className="field"><span>Mobile phone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label className="field"><span>Public ID</span><input value={publicId} onChange={(event) => setPublicId(event.target.value)} placeholder="GGS-NAME" /></label>
          <label className="field"><span>Photo URL</span><input value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} /></label>
          <button className="primary-button" disabled={!fullName.trim() || !phone.trim() || !publicId.trim() || create.isPending} type="submit">
            {create.isPending ? 'Adding…' : 'Add concierge'}
          </button>
        </form>
        <section className="ops-panel concierge-directory-panel">
          <div className="panel-heading">
            <h2>Directory</h2>
            {conciergesQuery.isFetching && <span className="muted-copy">Syncing…</span>}
          </div>
          {conciergesQuery.isLoading && <LoadingState label="Loading concierges" />}
          <ApiErrorMessage error={conciergesQuery.error} />
          {!conciergesQuery.isLoading && concierges.length === 0 ? (
            <EmptyState title="No concierges yet" body="Add the first concierge here, then assign them to a trip from the trip detail page." />
          ) : (
            <ul className="operator-list">
              {concierges.map((concierge) => (
                <li className="operator-row" key={concierge.id}>
                  <span className="operator-avatar" aria-hidden="true">{initials(concierge.fullName)}</span>
                  <div>
                    <strong>{concierge.fullName}</strong>
                    <small>{concierge.publicId}</small>
                  </div>
                  <span>{concierge.phone}</span>
                  <mark data-status={concierge.active ? 'active' : 'inactive'}>
                    {concierge.active ? 'Active' : 'Inactive'}
                  </mark>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
