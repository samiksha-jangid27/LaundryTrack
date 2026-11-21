import { useState } from 'react';
import { Shirt, ShieldCheck, ScanLine, Truck, Leaf } from 'lucide-react';
import { useSession } from '../session';
import { Brand, Button, Field, ErrorBox } from '../components/UI';
export default function Auth() {
  const { login, demo } = useSession();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await login(body, register);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function tryDemo(role) {
    setBusy(true);
    setError('');
    try {
      await login({ email: `${role}@laundrytrack.demo`, password: 'FreshStart!2026' });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-content">
          <span className="pill light">
            <Leaf size={16} /> Thoughtful care. Clear tracking.
          </span>
          <h1>
            Fresh clothes.
            <br />A lighter mind.
          </h1>
          <p>
            From your doorstep and back, know where your clothes are — and that every piece is
            coming home.
          </p>
          <div className="laundry-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="washer">
              <div className="washer-controls">
                <i />
                <span />
                <b />
              </div>
              <div className="washer-door">
                <Shirt size={74} strokeWidth={1.2} />
              </div>
            </div>
            <div className="floating-tag">
              <ShieldCheck size={22} />
              <div>
                <strong>Every piece matters</strong>
                <small>Verified at every handoff</small>
              </div>
            </div>
          </div>
          <div className="story-features">
            <span>
              <Truck size={19} />
              Doorstep pickup
            </span>
            <span>
              <ScanLine size={19} />
              Garment tracking
            </span>
          </div>
        </div>
        <small>LAUNDRYTRACK / CARE IN EVERY STEP</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <p className="eyebrow">A FRESH START</p>
          <h2>{register ? 'Make room for a little less laundry.' : 'Welcome back.'}</h2>
          <p className="lead">
            {register
              ? 'Create your account and book your first pickup.'
              : 'Your wardrobe is in good hands. Let’s get you in.'}
          </p>
          <ErrorBox error={error} />
          <form onSubmit={submit}>
            {register && (
              <>
                <Field label="Your name">
                  <input
                    name="name"
                    required
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Your full name"
                  />
                </Field>
                <Field label="Mobile number">
                  <input
                    name="phone"
                    type="tel"
                    required
                    pattern="[6-9][0-9]{9}"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                  />
                </Field>
              </>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" hint={register ? 'Use at least 10 characters.' : null}>
              <input
                name="password"
                type="password"
                minLength={register ? 10 : 1}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                placeholder="Enter your password"
              />
            </Field>
            <Button busy={busy} className="full">
              {register ? 'Create account' : 'Sign in'}
            </Button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to LaundryTrack?'}{' '}
            <button
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          {demo && (
            <div className="demo-options">
              <span>EXPLORE THE DEMO</span>
              <p>Sample accounts and synthetic orders. Pick a view.</p>
              <div>
                {['customer', 'staff', 'owner'].map((role) => (
                  <Button key={role} busy={busy} variant="secondary" onClick={() => tryDemo(role)}>
                    {role === 'staff' ? 'Outlet team' : role[0].toUpperCase() + role.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
