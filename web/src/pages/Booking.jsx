import { useState, useRef } from 'react';
import { Minus, Plus, Shirt, CalendarDays, MapPin, ShieldCheck } from 'lucide-react';
import { money } from '@laundrytrack/core';
import { useResource } from '../hooks';
import { useSession } from '../session';
import { api } from '../api';
import { PageHeading, Field, Button, ErrorBox, Loading } from '../components/UI';
export default function Booking() {
  const { user } = useSession();
  const { data, error, loading } = useResource('/services');
  const [quantities, setQuantities] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const [created, setCreated] = useState(null);
  const requestRef = useRef(null);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const max = new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });
  const services = data?.services || [];
  const count = Object.values(quantities).reduce((n, q) => n + q, 0);
  const total = services.reduce((n, s) => n + s.price * (quantities[s.id] || 0), 0);
  async function submit(e) {
    e.preventDefault();
    if (!count) {
      setFailure('Add at least one garment to your bag.');
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      const signature = JSON.stringify({ fields, quantities });
      if (requestRef.current?.signature !== signature)
        requestRef.current = { signature, id: crypto.randomUUID() };
      const { order } = await api('/orders', {
        method: 'POST',
        body: {
          ...fields,
          requestId: requestRef.current.id,
          items: services
            .filter((s) => quantities[s.id])
            .map((s) => ({ serviceId: s.id, quantity: quantities[s.id] })),
        },
      });
      sessionStorage.setItem(`delivery.${order.id}`, order.deliveryCode);
      setCreated(order);
    } catch (e) {
      setFailure(e);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (created)
    return (
      <div className="booking-success">
        <span className="success-symbol">
          <ShieldCheck size={42} />
        </span>
        <p className="eyebrow">YOUR FRESH START IS BOOKED</p>
        <h1>We’ll take it from here.</h1>
        <p>
          {created.number} · {created.expected_count} garments · {money(created.total)}
        </p>
        <div className="delivery-code">
          <small>Your delivery acknowledgement code</small>
          <strong>{created.deliveryCode}</strong>
          <p>
            Keep this private. Share it with the delivery partner when you receive your clothes.
          </p>
        </div>
        <a className="button" href={`#orders/${created.id}`}>
          View your order
        </a>
      </div>
    );
  return (
    <>
      <PageHeading eyebrow="MAKE SOME ROOM IN YOUR DAY" title="Let’s take a load off.">
        Choose your care, tell us where to collect, and we’ll handle the rest.
      </PageHeading>
      <ErrorBox error={failure || error} />
      <form onSubmit={submit} className="booking-layout">
        <div>
          <section className="section-card">
            <div className="section-heading">
              <div>
                <h2>What needs a little care?</h2>
                <p>Count each garment once. All services are priced per item.</p>
              </div>
              <Shirt />
            </div>
            {services.map((s) => (
              <div className="booking-service" key={s.id}>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <strong>
                    {money(s.price)} <small>/ item · {s.hours}h standard care</small>
                  </strong>
                </div>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`Remove ${s.name} item`}
                    disabled={!quantities[s.id]}
                    onClick={() =>
                      setQuantities((q) => ({ ...q, [s.id]: Math.max(0, (q[s.id] || 0) - 1) }))
                    }
                  >
                    <Minus size={16} />
                  </button>
                  <output aria-live="polite">{quantities[s.id] || 0}</output>
                  <button
                    type="button"
                    aria-label={`Add ${s.name} item`}
                    disabled={quantities[s.id] >= 30}
                    onClick={() => setQuantities((q) => ({ ...q, [s.id]: (q[s.id] || 0) + 1 }))}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </section>
          <section className="section-card">
            <div className="section-heading">
              <div>
                <h2>
                  <MapPin size={20} /> Your doorstep details
                </h2>
                <p>We’ll collect and return your order to this address.</p>
              </div>
            </div>
            <Field label="Pickup & delivery address">
              <textarea
                name="address"
                required
                maxLength={350}
                rows={3}
                placeholder="Flat / house, building, street, locality and PIN code"
              />
            </Field>
            <div className="form-grid">
              <Field label="Mobile number">
                <input
                  name="phone"
                  type="tel"
                  required
                  pattern="[6-9][0-9]{9}"
                  defaultValue={user.phone}
                />
              </Field>
              <Field label="Pickup date">
                <input
                  name="pickupDate"
                  type="date"
                  min={today}
                  max={max}
                  defaultValue={today}
                  required
                />
              </Field>
            </div>
            <Field label="Pickup window">
              <select name="slot">
                <option>09:00–12:00</option>
                <option>12:00–15:00</option>
                <option>15:00–18:00</option>
              </select>
            </Field>
            <Field label="Care notes (optional)">
              <textarea
                name="notes"
                maxLength={500}
                rows={2}
                placeholder="A delicate fabric, a mark to check, or something we should know"
              />
            </Field>
          </section>
        </div>
        <aside className="booking-summary section-card">
          <p className="eyebrow">YOUR LAUNDRY BAG</p>
          <h2>A fresh start, itemised.</h2>
          {!count ? (
            <p className="subtle">Add a few items to get started.</p>
          ) : (
            services
              .filter((s) => quantities[s.id])
              .map((s) => (
                <div className="summary-row" key={s.id}>
                  <span>
                    {s.name} × {quantities[s.id]}
                  </span>
                  <strong>{money(s.price * quantities[s.id])}</strong>
                </div>
              ))
          )}
          <div className="summary-total">
            <span>Estimated total</span>
            <strong>{money(total)}</strong>
          </div>
          <p className="summary-note">
            {count} garments · No delivery charge in this pilot. Any care exception is discussed
            before processing.
          </p>
          <Button busy={busy} disabled={!count} className="full">
            Confirm pickup
          </Button>
          <div className="summary-trust">
            <ShieldCheck size={22} />
            <p>You’ll receive a counted pickup receipt and a garment-by-garment care trail.</p>
          </div>
        </aside>
      </form>
    </>
  );
}
