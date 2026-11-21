export async function flushActions({ actions, send, remove }) {
  let sent = 0;
  for (const action of actions) {
    try {
      await send(action);
      remove(action.body.eventId);
      sent++;
    } catch (error) {
      return { sent, remaining: actions.length - sent, error };
    }
  }
  return { sent, remaining: 0, error: null };
}
