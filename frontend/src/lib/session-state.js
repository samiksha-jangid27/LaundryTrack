export function readSavedSession(value) {
  try {
    const saved = JSON.parse(value);
    if (
      typeof saved?.token !== 'string' ||
      !saved.token ||
      typeof saved?.user?.id !== 'string' ||
      typeof saved.user.name !== 'string' ||
      !['customer', 'staff', 'owner'].includes(saved.user.role) ||
      !Number.isFinite(Date.parse(saved.expiresAt))
    )
      return null;
    return saved;
  } catch {
    return null;
  }
}
