import { useState } from 'react';
import { MessageSquare, CheckCircle2 } from 'lucide-react';
import { Button, Field } from './UI';
export default function Issues({ order, staff, act, busy }) {
  const [show, setShow] = useState(false);
  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <h2>
            <MessageSquare size={20} /> A little help, if you need it
          </h2>
          <p>Keep questions and resolutions with the order.</p>
        </div>
        {!staff && (
          <Button variant="secondary" onClick={() => setShow(!show)}>
            {show ? 'Close form' : 'Raise an issue'}
          </Button>
        )}
      </div>
      {show && (
        <form
          className="issue-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await act('issues', Object.fromEntries(new FormData(e.currentTarget)));
            if (ok) setShow(false);
          }}
        >
          <Field label="What’s this about?">
            <select name="category">
              <option value="missing">Missing garment</option>
              <option value="damage">Damage or care</option>
              <option value="delay">Delivery delay</option>
              <option value="billing">Billing</option>
              <option value="other">Something else</option>
            </select>
          </Field>
          <Field label="Tell us a little more">
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={1000}
              rows={3}
              placeholder="Please share enough detail for the outlet to help."
            />
          </Field>
          <Button busy={busy}>Send to the outlet</Button>
        </form>
      )}
      {order.issues.length ? (
        order.issues.map((issue) => (
          <div className="issue" key={issue.id}>
            <div>
              <span className="pill">{issue.category}</span>
              <span className={`badge ${issue.status === 'resolved' ? 'success' : 'progress'}`}>
                {issue.status === 'resolved' ? 'Resolved' : 'Open'}
              </span>
            </div>
            <p>{issue.message}</p>
            <small>{new Date(issue.created_at).toLocaleString('en-IN')}</small>
            {issue.resolution && (
              <div className="resolution">
                <CheckCircle2 size={18} />
                <p>{issue.resolution}</p>
              </div>
            )}
            {staff && issue.status === 'open' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(
                    `issues/${issue.id}/resolve`,
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                }}
              >
                <Field label="Outlet response">
                  <textarea name="resolution" minLength={10} maxLength={1000} rows={2} required />
                </Field>
                <Button busy={busy} variant="secondary">
                  Resolve issue
                </Button>
              </form>
            )}
          </div>
        ))
      ) : (
        <p className="subtle">No issues raised. If something needs attention, this is the place.</p>
      )}
    </section>
  );
}
