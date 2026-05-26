const TOKEN_KEY = 'token'

export function readAccessTokenFromUrl(queryToken?: string) {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const hashParams = new URLSearchParams(hash)
  const fromHash = hashParams.get(TOKEN_KEY)
  if (fromHash) return fromHash

  if (queryToken) {
    promoteQueryToHash(queryToken)
    return queryToken
  }
  return ''
}

export function toFragmentLink(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    const token = url.searchParams.get(TOKEN_KEY)
    if (!token) return rawUrl
    url.searchParams.delete(TOKEN_KEY)
    const fragment = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
    fragment.set(TOKEN_KEY, token)
    url.hash = fragment.toString()
    return url.toString()
  } catch {
    return rawUrl
  }
}

function promoteQueryToHash(token: string) {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(TOKEN_KEY)) return
    url.searchParams.delete(TOKEN_KEY)
    const fragment = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
    fragment.set(TOKEN_KEY, token)
    url.hash = fragment.toString()
    window.history.replaceState(window.history.state, '', url.toString())
  } catch {
    /* noop — fall back to legacy query reading */
  }
}
