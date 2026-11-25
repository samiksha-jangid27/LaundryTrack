export function normalizeBaseUrl(value, { requireHttps = false } = {}) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter the API server address, such as https://api.example.com.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      'Enter only the server address, without /api, credentials or query parameters.',
    );
  if (requireHttps && url.protocol !== 'https:')
    throw new Error('This build requires an HTTPS API address.');
  return url.origin;
}

// Kept independent of native modules so the actual transport is integration-tested in Node.
export function createHttpClient({
  getBaseUrl,
  getToken,
  onUnauthorized,
  fetchImpl = fetch,
  timeoutMs = 12000,
}) {
  return async (path, { method = 'GET', body, responseType = 'json' } = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const requestToken = getToken();
    try {
      let response, raw;
      try {
        response = await fetchImpl(getBaseUrl() + '/api' + path, {
          method,
          headers: {
            ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        raw = response.status === 204 ? '' : await response.text();
      } catch {
        throw Object.assign(
          new Error('Cannot reach the outlet. Check your connection or API address.'),
          { offline: true },
        );
      }
      let data;
      if (raw && (responseType === 'json' || !response.ok)) {
        try {
          data = JSON.parse(raw);
        } catch {
          /* A proxy may return an HTML error page. */
        }
      }
      if (!response.ok) {
        if (response.status === 401 && requestToken && requestToken === getToken())
          await onUnauthorized?.();
        throw Object.assign(
          new Error(
            data?.error || `The outlet returned an error (${response.status}). Please try again.`,
          ),
          {
            status: response.status,
            code: data?.code,
          },
        );
      }
      if (response.status === 204) return null;
      if (responseType === 'text') return raw;
      if (!data || typeof data !== 'object')
        throw new Error(
          'The server did not return a valid LaundryTrack response. Check the API address.',
        );
      return data;
    } finally {
      clearTimeout(timeout);
    }
  };
}
