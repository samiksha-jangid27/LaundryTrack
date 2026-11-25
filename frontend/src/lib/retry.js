// Retain the complete request after a transport failure: the API may already have committed it.
export function createRetryRequest(makeId, { load = () => null, save = () => {} } = {}) {
  let pending = load();
  return {
    prepare(signature, fields) {
      if (pending?.signature !== signature) {
        pending = { signature, body: { eventId: makeId(), ...fields } };
        save(pending);
      }
      return pending.body;
    },
    clear() {
      save(null);
      pending = null;
    },
  };
}
