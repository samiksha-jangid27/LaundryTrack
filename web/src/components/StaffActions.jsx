import { useState } from 'react';
import { ScanLine, ClipboardCheck, Truck, UserRoundCheck } from 'lucide-react';
import { nextStage, STAGE_LABELS, parseTag } from '@laundrytrack/core';
import { useResource } from '../hooks';
import { Button, Field } from './UI';
export default function StaffActions({ order, act, busy, onError }) {
  const { data } = useResource('/outlet/staff');
  const [scan, setScan] = useState('');
  const [selected, setSelected] = useState([]);
  const [code, setCode] = useState('');
  if (['delivered', 'cancelled'].includes(order.stage)) return null;
  const next = nextStage(order.stage);
  const pending = order.garments.filter((g) => !g.delivered);
  return (
    <section className="section-card action-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">OUTLET ACTIONS</p>
          <h2>The next careful step.</h2>
        </div>
        <ClipboardCheck />
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          act('assign', Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <Field label="Assigned team member">
          <select
            name="staffId"
            key={order.assigned_to}
            defaultValue={order.assigned_to || ''}
            required
          >
            <option value="" disabled>
              Choose a team member
            </option>
            {data?.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Button busy={busy} variant="secondary">
          <UserRoundCheck size={17} />
          Assign
        </Button>
      </form>
      {order.stage === 'booked' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act('collect', { count: Number(new FormData(e.currentTarget).get('count')) });
          }}
        >
          <Field
            label={`Count at pickup (${order.expected_count} expected)`}
            hint="Resolve any mismatch with the customer before accepting custody."
          >
            <input
              name="count"
              type="number"
              min={1}
              max={360}
              defaultValue={order.expected_count}
              required
            />
          </Field>
          <Button busy={busy}>Confirm counted pickup</Button>
        </form>
      )}
      {order.stage === 'collected' && (
        <>
          <p className="subtle">
            Register each garment at intake. {order.garments.length} / {order.collected_count}{' '}
            recorded.
          </p>
          {order.garments.length < order.collected_count && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const ok = await act('garments', Object.fromEntries(new FormData(form)));
                if (ok) form.reset();
              }}
            >
              <div className="form-grid">
                <Field label="Garment type">
                  <input
                    name="type"
                    list="garment-types"
                    required
                    maxLength={50}
                    placeholder="Shirt"
                  />
                  <datalist id="garment-types">
                    <option>Shirt</option>
                    <option>T-shirt</option>
                    <option>Trousers</option>
                    <option>Dress</option>
                    <option>Kurta</option>
                    <option>Bedsheet</option>
                    <option>Towel</option>
                  </datalist>
                </Field>
                <Field label="Colour">
                  <input name="color" required maxLength={40} placeholder="Blue" />
                </Field>
              </div>
              <Field label="Existing marks or care notes">
                <input
                  name="note"
                  maxLength={200}
                  placeholder="Optional · agree visible defects at intake"
                />
              </Field>
              <Button busy={busy} variant="secondary">
                Register garment
              </Button>
            </form>
          )}
        </>
      )}
      {order.stage === 'packing' && (
        <div className="packing-workspace">
          <p>
            {order.garments.filter((g) => g.packed).length} / {order.garments.length} pieces
            verified. Every piece must match this order.
          </p>
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const garmentId = parseTag(scan);
              if (!garmentId) {
                onError(new Error('Scan a LaundryTrack garment QR or enter its full payload.'));
                return;
              }
              if (await act('scan', { garmentId })) setScan('');
            }}
          >
            <Field
              label="Garment QR payload"
              hint="Use a USB barcode scanner, or the mobile camera scanner."
            >
              <input
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="laundrytrack:garment:…"
                required
                autoComplete="off"
              />
            </Field>
            <Button busy={busy}>
              <ScanLine size={17} />
              Verify piece
            </Button>
          </form>
          {order.garments
            .filter((g) => g.packed)
            .map((g) => (
              <div className="packed-row" key={g.id}>
                <span>
                  {g.color} {g.type}
                </span>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => act('unpack', { garmentId: g.id })}
                >
                  Remove for recheck
                </button>
              </div>
            ))}
        </div>
      )}
      {next && !['collected', 'delivered'].includes(next) && (
        <Button busy={busy} className="advance-button" onClick={() => act('advance')}>
          Mark {STAGE_LABELS[next].toLowerCase()}
        </Button>
      )}
      {order.stage === 'out_for_delivery' && (
        <form
          className="delivery-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selected.length) {
              onError(new Error('Select the garments the customer is receiving.'));
              return;
            }
            if (await act('deliver', { code, garmentIds: selected })) {
              setSelected([]);
              setCode('');
            }
          }}
        >
          <h3>
            <Truck size={19} /> Customer handoff
          </h3>
          <p>
            Select only the garments physically handed over. Partial returns keep the remaining
            items open.
          </p>
          {pending.map((g) => (
            <label className="check-row" key={g.id}>
              <input
                type="checkbox"
                checked={selected.includes(g.id)}
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked ? [...ids, g.id] : ids.filter((id) => id !== g.id),
                  )
                }
              />
              {g.color} {g.type}
            </label>
          ))}
          <Field label="Customer’s 6-digit delivery code">
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="off"
            />
          </Field>
          <Button busy={busy}>Acknowledge {selected.length} returned garments</Button>
        </form>
      )}
    </section>
  );
}
