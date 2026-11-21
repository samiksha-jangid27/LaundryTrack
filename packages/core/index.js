import { z } from 'zod';
export const STAGES = [
  'booked',
  'collected',
  'received',
  'cleaning',
  'quality_check',
  'packing',
  'ready',
  'out_for_delivery',
  'delivered',
];
export const STAGE_LABELS = {
  booked: 'Pickup booked',
  collected: 'Collected',
  received: 'At the outlet',
  cleaning: 'Being cleaned',
  quality_check: 'Quality check',
  packing: 'Packing',
  ready: 'Ready for delivery',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
export const ROLES = ['customer', 'staff', 'owner'];
export const money = (paise) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
export const dateLabel = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const canOperate = (user) => ['staff', 'owner'].includes(user?.role);
const text = (max) => z.string().trim().min(1).max(max);
export const loginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
export const registerSchema = loginSchema.extend({
  name: text(80),
  password: z.string().min(10).max(128),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});
export const bookingSchema = z.object({
  address: text(350),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['09:00–12:00', '12:00–15:00', '15:00–18:00']),
  notes: z.string().trim().max(500).default(''),
  items: z
    .array(z.object({ serviceId: text(60), quantity: z.number().int().min(1).max(30) }))
    .min(1)
    .max(12),
});
export const actionSchema = z.object({
  eventId: z.uuid(),
  version: z.number().int().nonnegative(),
});
export const garmentSchema = z.object({
  type: text(50),
  color: text(40),
  note: z.string().trim().max(200).default(''),
});
export const issueSchema = z.object({
  category: z.enum(['missing', 'damage', 'delay', 'billing', 'other']),
  message: z.string().trim().min(10).max(1000),
  garmentId: z.string().max(100).optional(),
});
export function nextStage(stage) {
  const index = STAGES.indexOf(stage);
  return index < 0 ? null : STAGES[index + 1] || null;
}
export function tagPayload(id) {
  return `laundrytrack:garment:${id}`;
}
export function parseTag(value) {
  const match = /^laundrytrack:garment:([a-zA-Z0-9-]{1,80})$/.exec(value.trim());
  return match?.[1] || null;
}
export function bookingTotal(items, catalog) {
  return items.reduce((sum, item) => {
    const service = catalog.find((s) => s.id === item.serviceId);
    if (!service) throw new Error('Service unavailable');
    return sum + service.price * item.quantity;
  }, 0);
}
