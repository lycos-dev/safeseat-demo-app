import { useEffect, useMemo, useState } from 'react';

type Tab = 'home' | 'seats' | 'everyone' | 'settings';
type ThemeMode = 'dark' | 'light';
type SeatState = 'empty' | 'safe' | 'warning' | 'emergency' | 'analyzing' | 'not-monitored' | 'ended';
type DemoState = 'safe' | 'warning' | 'emergency';

type Person = {
  id: string;
  name: string;
  type: 'owner' | 'profile' | 'guest';
  initials: string;
};

type SeatAssignment = {
  seatNo: number;
  personId?: string;
  consent: boolean;
};

type Telemetry = {
  hr: number;
  rr: number;
  temp: number;
  occupied: boolean;
  movement: 'Stable' | 'Movement detected' | 'Verification active';
  camera: 'Standby' | 'Verifying';
  updatedAt: number;
};

type HistorySession = {
  id: string;
  seatNo: number;
  personName: string;
  startedAt: number;
  endedAt: number;
  durationMin: number;
  hrAvg: number;
  hrMin: number;
  hrMax: number;
  rrAvg: number;
  rrMin: number;
  rrMax: number;
  tempAvg: number;
  tempMin: number;
  tempMax: number;
  movementEvents: number;
  verificationEvents: number;
  warningEvents: number;
  emergencyEvents: number;
  outcome: string;
};

type Modal =
  | { type: 'none' }
  | { type: 'live'; seatNo: number }
  | { type: 'end' }
  | { type: 'summary'; session: HistorySession }
  | { type: 'history'; session: HistorySession }
  | { type: 'history-list' }
  | { type: 'assign'; seatNo: number }
  | { type: 'consent'; seatNo: number; personId: string }
  | { type: 'add-profile' }
  | { type: 'diagnostics' }
  | { type: 'guide' }
  | { type: 'help' };

const SEATS = [
  { no: 1, role: 'Driver' },
  { no: 2, role: 'Front Passenger' },
  { no: 3, role: 'Rear Left' },
  { no: 4, role: 'Rear Center' },
  { no: 5, role: 'Rear Right' },
];

const DEFAULT_PEOPLE: Person[] = [
  { id: 'owner', name: 'Lycos Blanza', type: 'owner', initials: 'LB' },
  { id: 'p-juan', name: 'Juan Dela Cruz', type: 'profile', initials: 'JD' },
  { id: 'p-maria', name: 'Maria Santos', type: 'profile', initials: 'MS' },
  { id: 'guest', name: 'Guest Passenger', type: 'guest', initials: 'G' },
];

const defaultAssignments: SeatAssignment[] = [
  { seatNo: 1, personId: 'owner', consent: true },
  { seatNo: 2, personId: 'p-juan', consent: true },
  { seatNo: 3, personId: 'guest', consent: true },
  { seatNo: 4, consent: false },
  { seatNo: 5, consent: false },
];

const storage = {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : fallback;
    } catch { return fallback; }
  },
  write<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const p: Record<string, any> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
    car: <><path d="M5 16h14l-1-6H6l-1 6Z"/><path d="m7 10 1.5-4h7L17 10"/><path d="M7 16v2M17 16v2"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.4-4 2.4-6 5.5-6s5.1 2 5.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14c3.1-.2 5 1.5 5.5 5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.5 1a7 7 0 0 0-1.7-1L14.4 3h-4.8l-.4 3.1a7 7 0 0 0-1.7 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.5-1a7 7 0 0 0 1.7 1l.4 3h4.8l.4-3a7 7 0 0 0 1.7-1l2.5 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1Z"/></>,
    heart: <path d="M20.8 4.6c-2-2-5.2-2-7.2 0L12 6.2l-1.6-1.6a5.1 5.1 0 0 0-7.2 7.2L12 20l8.8-8.2a5.1 5.1 0 0 0 0-7.2Z"/>,
    lungs: <><path d="M10 12V5c0-1.5-1-2-2-1-1.4 1.4-2.4 3.5-3.2 6.1C3.9 13 4.1 17 7 18.5c1.4.7 3-.2 3-1.8V12Z"/><path d="M14 12V5c0-1.5 1-2 2-1 1.4 1.4 2.4 3.5 3.2 6.1.9 2.9.7 6.9-2.2 8.4-1.4.7-3-.2-3-1.8V12Z"/><path d="M12 3v9"/></>,
    temp: <><path d="M10 14.8V5a2 2 0 0 1 4 0v9.8a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    history: <><path d="M4 12a8 8 0 1 0 2-5.3L4 9"/><path d="M4 4v5h5"/><path d="M12 8v5l3 2"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.5 2.6 8 7 10 4.4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
    logout: <><path d="M10 5H5v14h5"/><path d="m13 8 4 4-4 4M17 12H9"/></>,
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z"/>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 18h4"/></>,
    person: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.4-7 8-7s7.2 2 8 7"/></>,
    sensor: <><path d="M8 15a6 6 0 0 1 0-6M5 18a10 10 0 0 1 0-12M16 9a6 6 0 0 1 0 6M19 6a10 10 0 0 1 0 12"/><circle cx="12" cy="12" r="2"/></>,
  };
  return <svg {...common}>{p[name] ?? p.info}</svg>;
}

function formatTime(ts: number) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
}
function formatDate(ts: number) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(ts));
}

function App() {
  const [loggedIn, setLoggedIn] = useState(() => storage.read('ss-web-auth', false));
  const [tab, setTab] = useState<Tab>('home');
  const [theme, setTheme] = useState<ThemeMode>(() => storage.read('ss-web-theme', 'dark'));
  const [people, setPeople] = useState<Person[]>(() => storage.read('ss-web-people', DEFAULT_PEOPLE));
  const [assignments, setAssignments] = useState<SeatAssignment[]>(() => storage.read('ss-web-assignments', defaultAssignments));
  const [hardwareSeat, setHardwareSeat] = useState(() => storage.read('ss-web-hardware-seat', 2));
  const [monitoring, setMonitoring] = useState(() => storage.read('ss-web-monitoring', true));
  const [activeStarted, setActiveStarted] = useState<Record<number, number>>(() => storage.read('ss-web-active-started', { 1: Date.now() - 22 * 60000, 2: Date.now() - 22 * 60000, 3: Date.now() - 14 * 60000 }));
  const [completedSeats, setCompletedSeats] = useState<Record<number, HistorySession>>({});
  const [history, setHistory] = useState<HistorySession[]>(() => storage.read('ss-web-history', []));
  const [modal, setModal] = useState<Modal>({ type: 'none' });
  const [demoState, setDemoState] = useState<DemoState>('safe');
  const [telemetry, setTelemetry] = useState<Telemetry>({ hr: 78, rr: 17.1, temp: 35.8, occupied: true, movement: 'Stable', camera: 'Standby', updatedAt: Date.now() });
  const [metric, setMetric] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [toast, setToast] = useState('');

  const assigned = useMemo(() => assignments.filter(a => a.personId), [assignments]);
  const activeSeats = useMemo(() => assigned.filter(a => Boolean(activeStarted[a.seatNo]) && !completedSeats[a.seatNo]), [assigned, activeStarted, completedSeats]);

  useEffect(() => { document.documentElement.dataset.theme = theme; storage.write('ss-web-theme', theme); }, [theme]);
  useEffect(() => storage.write('ss-web-people', people), [people]);
  useEffect(() => storage.write('ss-web-assignments', assignments), [assignments]);
  useEffect(() => storage.write('ss-web-hardware-seat', hardwareSeat), [hardwareSeat]);
  useEffect(() => storage.write('ss-web-monitoring', monitoring), [monitoring]);
  useEffect(() => storage.write('ss-web-active-started', activeStarted), [activeStarted]);
  useEffect(() => storage.write('ss-web-history', history), [history]);

  useEffect(() => {
    if (!monitoring) return;
    const timer = window.setInterval(() => {
      setTelemetry(prev => {
        const stateShift = demoState === 'safe' ? 0 : demoState === 'warning' ? 13 : 31;
        const hr = Math.max(58, Math.min(155, Math.round(prev.hr + (Math.random() - .5) * 6 + (stateShift ? (stateShift - Math.max(0, prev.hr - 80)) * .08 : 0))));
        const rr = Math.max(10, Math.min(36, Math.round((prev.rr + (Math.random() - .5) * 1.5 + (demoState === 'safe' ? 0 : .4)) * 10) / 10));
        const temp = Math.round((prev.temp + (Math.random() - .5) * .16) * 10) / 10;
        const movement = demoState === 'safe' ? (Math.random() > .92 ? 'Movement detected' : 'Stable') : demoState === 'warning' ? 'Verification active' : 'Movement detected';
        return { ...prev, hr, rr, temp, movement, camera: demoState === 'warning' ? 'Verifying' : 'Standby', updatedAt: Date.now() };
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [monitoring, demoState]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const personForSeat = (seatNo: number) => {
    const a = assignments.find(x => x.seatNo === seatNo);
    return people.find(p => p.id === a?.personId);
  };

  const stateForSeat = (seatNo: number): SeatState => {
    if (completedSeats[seatNo]) return 'ended';
    const person = personForSeat(seatNo);
    if (!person) return 'empty';
    if (!monitoring || !activeStarted[seatNo]) return seatNo === hardwareSeat ? 'analyzing' : 'not-monitored';
    if (seatNo !== hardwareSeat) return 'not-monitored';
    if (demoState === 'safe') return 'safe';
    if (demoState === 'warning') return 'warning';
    return 'emergency';
  };

  const endSeat = (seatNo: number) => {
    const person = personForSeat(seatNo);
    if (!person) return;
    const started = activeStarted[seatNo] ?? Date.now() - 10 * 60000;
    const ended = Date.now();
    const durationMin = Math.max(1, Math.round((ended - started) / 60000));
    const spread = demoState === 'safe' ? 7 : demoState === 'warning' ? 15 : 25;
    const s: HistorySession = {
      id: `SS-${ended}-${seatNo}`,
      seatNo,
      personName: person.type === 'owner' ? 'Me' : person.name,
      startedAt: started,
      endedAt: ended,
      durationMin,
      hrAvg: telemetry.hr,
      hrMin: Math.max(52, telemetry.hr - spread),
      hrMax: telemetry.hr + spread,
      rrAvg: Math.round(telemetry.rr * 10) / 10,
      rrMin: Math.max(8, Math.round((telemetry.rr - 2.8) * 10) / 10),
      rrMax: Math.round((telemetry.rr + 3.2) * 10) / 10,
      tempAvg: telemetry.temp,
      tempMin: Math.round((telemetry.temp - .4) * 10) / 10,
      tempMax: Math.round((telemetry.temp + .3) * 10) / 10,
      movementEvents: demoState === 'safe' ? 2 : 5,
      verificationEvents: demoState === 'safe' ? 0 : 1,
      warningEvents: demoState === 'safe' ? 0 : 1,
      emergencyEvents: demoState === 'emergency' ? 1 : 0,
      outcome: demoState === 'emergency' ? 'Emergency escalation recorded' : demoState === 'warning' ? 'Verification completed' : 'Normal monitoring completed'
    };
    setCompletedSeats(prev => ({ ...prev, [seatNo]: s }));
    setHistory(prev => [s, ...prev]);
    setActiveStarted(prev => { const next = { ...prev }; delete next[seatNo]; return next; });
    setModal({ type: 'summary', session: s });
    setToast(`${SEATS.find(s => s.no === seatNo)?.role} session saved`);
  };

  const dismissCompleted = (seatNo: number) => {
    setCompletedSeats(prev => { const next = { ...prev }; delete next[seatNo]; return next; });
    setAssignments(prev => prev.map(a => a.seatNo === seatNo ? { seatNo, consent: false } : a));
    setModal({ type: 'none' });
  };

  const startMonitoring = () => {
    const start: Record<number, number> = { ...activeStarted };
    assignments.filter(a => a.personId && a.consent).forEach(a => { if (!start[a.seatNo]) start[a.seatNo] = Date.now(); });
    setActiveStarted(start);
    setCompletedSeats({});
    setMonitoring(true);
    setDemoState('safe');
    setToast('Monitoring started');
    setTab('home');
  };

  const assignPerson = (seatNo: number, personId: string) => {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    if (person.type === 'owner' && seatNo !== 1) { setToast('Account owner can only be assigned as Driver'); return; }
    setAssignments(prev => prev.map(a => a.seatNo === seatNo ? { seatNo, personId, consent: person.type === 'owner' } : a));
    if (person.type !== 'owner') setModal({ type: 'consent', seatNo, personId }); else setModal({ type: 'none' });
  };

  const resetDemo = () => {
    localStorage.clear();
    setPeople(DEFAULT_PEOPLE);
    setAssignments(defaultAssignments);
    setHardwareSeat(2);
    setMonitoring(true);
    setActiveStarted({ 1: Date.now() - 22 * 60000, 2: Date.now() - 22 * 60000, 3: Date.now() - 14 * 60000 });
    setCompletedSeats({});
    setHistory([]);
    setDemoState('safe');
    setTelemetry({ hr: 78, rr: 17.1, temp: 35.8, occupied: true, movement: 'Stable', camera: 'Standby', updatedAt: Date.now() });
    setToast('Demo data reset');
  };

  if (!loggedIn) return <AuthScreen onLogin={() => { storage.write('ss-web-auth', true); setLoggedIn(true); }} />;

  return (
    <div className="stage">
      <main className="phone-shell">
        <div className="status-bar"><span>9:41</span><span className="status-icons">● ◒ ▰</span></div>
        <div className="screen">
          {tab === 'home' && <HomeScreen
            assignments={assignments} people={people} hardwareSeat={hardwareSeat} stateForSeat={stateForSeat}
            telemetry={telemetry} monitoring={monitoring} activeSeats={activeSeats.length} completedSeats={completedSeats}
            onSeat={(seatNo: number) => {
              if (completedSeats[seatNo]) setModal({ type: 'summary', session: completedSeats[seatNo] });
              else if (!personForSeat(seatNo)) { setTab('seats'); setModal({ type: 'assign', seatNo }); }
              else if (seatNo === hardwareSeat && activeStarted[seatNo]) setModal({ type: 'live', seatNo });
              else setToast(seatNo === hardwareSeat ? 'Sensor is ready for this seat' : 'Assigned · No sensor linked');
            }}
            onEnd={() => setModal({ type: 'end' })}
          />}
          {tab === 'seats' && <SeatsScreen assignments={assignments} people={people} hardwareSeat={hardwareSeat} monitoring={monitoring} onAssign={(n: number) => setModal({ type: 'assign', seatNo: n })} onHardware={setHardwareSeat} onStart={startMonitoring} />}
          {tab === 'everyone' && <EveryoneScreen people={people} onAdd={() => setModal({ type: 'add-profile' })} />}
          {tab === 'settings' && <SettingsScreen
            theme={theme} setTheme={setTheme} metric={metric} setMetric={setMetric} notifications={notifications} setNotifications={setNotifications}
            history={history} onHistory={(s: HistorySession) => setModal({ type: 'history', session: s })} onHistoryList={() => setModal({ type: 'history-list' })} onDiagnostics={() => setModal({ type: 'diagnostics' })}
            onGuide={() => setModal({ type: 'guide' })} onHelp={() => setModal({ type: 'help' })} onReset={resetDemo}
            onLogout={() => { storage.write('ss-web-auth', false); setLoggedIn(false); }}
          />}
        </div>
        <BottomTabs tab={tab} setTab={setTab} />
        {modal.type !== 'none' && <ModalLayer modal={modal} onClose={() => setModal({ type: 'none' })}>
          {modal.type === 'live' && <LiveDetail seatNo={modal.seatNo} person={personForSeat(modal.seatNo)} telemetry={telemetry} demoState={demoState} onState={setDemoState} onEnd={() => endSeat(modal.seatNo)} />}
          {modal.type === 'end' && <EndSessions activeSeats={activeSeats} people={people} assignments={assignments} activeStarted={activeStarted} onEnd={endSeat} onEndAll={() => { [...activeSeats].forEach(a => endSeat(a.seatNo)); }} />}
          {modal.type === 'summary' && <SessionSummary session={modal.session} onDetail={() => setModal({ type: 'history', session: modal.session })} onDismiss={() => dismissCompleted(modal.session.seatNo)} />}
          {modal.type === 'history' && <SessionDetail session={modal.session} />}
          {modal.type === 'history-list' && <HistoryList history={history} onOpen={(session: HistorySession) => setModal({ type: 'history', session })} />}
          {modal.type === 'assign' && <AssignModal seatNo={modal.seatNo} people={people} onAssign={(id: string) => assignPerson(modal.seatNo, id)} onClear={() => { setAssignments(prev => prev.map(a => a.seatNo === modal.seatNo ? { seatNo: modal.seatNo, consent: false } : a)); setModal({ type: 'none' }); }} />}
          {modal.type === 'consent' && <ConsentModal person={people.find(p => p.id === modal.personId)!} onConfirm={() => { setAssignments(prev => prev.map(a => a.seatNo === modal.seatNo ? { ...a, consent: true } : a)); if (monitoring) setActiveStarted(prev => ({ ...prev, [modal.seatNo]: Date.now() })); setModal({ type: 'none' }); setToast('Monitoring consent confirmed'); }} onDecline={() => { setAssignments(prev => prev.map(a => a.seatNo === modal.seatNo ? { ...a, consent: false } : a)); setModal({ type: 'none' }); }} />}
          {modal.type === 'add-profile' && <AddProfile onAdd={(name) => { const p: Person = { id: `p-${Date.now()}`, name, type: 'profile', initials: name.split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase() }; setPeople(prev => [...prev, p]); setModal({ type: 'none' }); setToast('Profile saved'); }} />}
          {modal.type === 'diagnostics' && <Diagnostics telemetry={telemetry} demoState={demoState} onState={setDemoState} />}
          {modal.type === 'guide' && <Guide />}
          {modal.type === 'help' && <Help />}
        </ModalLayer>}
        {demoState === 'emergency' && modal.type !== 'diagnostics' && <div className="emergency-ribbon">DEMO EMERGENCY · Check passenger now</div>}
        {toast && <div className="toast">{toast}</div>}
      </main>
    </div>
  );
}

function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login'|'signup'>('login');
  const [email, setEmail] = useState('demo@safeseat.app');
  const [password, setPassword] = useState('SafeSeat2026!');
  return <div className="stage auth-stage"><main className="phone-shell auth-shell">
    <div className="status-bar"><span>9:41</span><span className="status-icons">● ◒ ▰</span></div>
    <div className="auth-screen">
      <div className="brand-mark"><img src="/safeseat-icon.png" /><div><strong>SafeSeat</strong><span>Passenger safety monitoring</span></div></div>
      <div className="auth-copy"><span className="eyebrow">SAFESEAT DEMO</span><h1>{mode === 'login' ? 'Welcome back' : 'Create account'}</h1><p>This browser build mirrors the SafeSeat mobile experience for presentation and Vercel deployment.</p></div>
      <label>Email<input value={email} onChange={(e: any) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} /></label>
      {mode === 'signup' && <label>Full name<input placeholder="Passenger name" /></label>}
      <button className="primary full" onClick={onLogin}>{mode === 'login' ? 'Sign in' : 'Create demo account'}</button>
      <button className="text-button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'New to SafeSeat? Create account' : 'Already have an account? Sign in'}</button>
      <div className="demo-note"><Icon name="info" size={18}/><div><strong>Demo-only web build</strong><span>Native sensors and hardware transport are simulated in-browser.</span></div></div>
    </div>
  </main></div>;
}

function HomeScreen(props: any) {
  const { assignments, people, hardwareSeat, stateForSeat, telemetry, monitoring, activeSeats, completedSeats, onSeat, onEnd } = props;
  const latest = Math.max(0, Math.floor((Date.now() - telemetry.updatedAt) / 1000));
  const linkedState = stateForSeat(hardwareSeat) as SeatState;
  const hero = linkedState === 'emergency' ? ['EMERGENCY','This person may need immediate help','emergency'] : linkedState === 'warning' ? ['WARNING','SafeSeat detected something unusual','warning'] : linkedState === 'safe' ? ['SAFE','No unusual signs detected','safe'] : ['ANALYZING','SafeSeat is checking the sensors','analyzing'];
  return <div className="page home-page">
    <header className="app-header"><div><span className="eyebrow">SAFESEAT</span><h2>Vehicle Monitor</h2></div><div className={`connection ${monitoring ? 'online':''}`}><i></i>{monitoring ? 'LIVE' : 'READY'}</div></header>
    <section className={`hero hero-${hero[2]}`}><div className="hero-top"><div className="hero-icon"><Icon name={hero[2] === 'safe' ? 'shield' : 'info'} size={23}/></div><div><span>{hero[0]}</span><strong>{hero[1]}</strong></div></div><div className="hero-meta"><span>{activeSeats} active passenger{activeSeats === 1 ? '' : 's'}</span><span>Updated {latest}s ago</span></div></section>
    <div className="monitor-heading"><span>PASSENGERS</span><b>{assignments.filter((a:any) => a.personId).length}/5 assigned</b></div>
    <div className="monitor-list">
      {SEATS.map(seat => {
        const a = assignments.find((x:any) => x.seatNo === seat.no);
        const p = people.find((x:any) => x.id === a?.personId);
        const state = stateForSeat(seat.no) as SeatState;
        return <SeatRow key={seat.no} seat={seat} person={p} state={state} hardware={seat.no === hardwareSeat} telemetry={telemetry} completed={completedSeats[seat.no]} onClick={() => onSeat(seat.no)} />;
      })}
    </div>
    <button className="secondary end-session" onClick={onEnd} disabled={activeSeats === 0}>End Session</button>
  </div>;
}

const STATE_META: Record<SeatState, {label:string; color:string; hint:string}> = {
  empty: { label:'EMPTY', color:'muted', hint:'Tap to assign' }, safe:{label:'SAFE',color:'green',hint:'No unusual signs'}, warning:{label:'WARNING',color:'amber',hint:'Check passenger'}, emergency:{label:'EMERGENCY',color:'red',hint:'Check passenger now'}, analyzing:{label:'ANALYZING',color:'blue',hint:'Checking sensors'}, 'not-monitored':{label:'NOT MONITORED',color:'muted',hint:'Assigned · No sensor'}, ended:{label:'ENDED',color:'blue',hint:'Session saved'}
};
function SeatRow({ seat, person, state, hardware, telemetry, completed, onClick }: any) {
  const m = STATE_META[state as SeatState];
  return <button className={`seat-row state-${m.color}`} onClick={onClick}><span className="rail"></span><div className="avatar">{person ? person.initials : seat.no}</div><div className="seat-ident"><span>{seat.no === 1 ? 'DRIVER' : seat.role.toUpperCase()}</span><strong className={!person ? 'muted':''}>{person ? (person.type === 'owner' ? 'Me' : person.type === 'guest' ? 'Guest' : person.name) : 'Unassigned'}</strong></div><div className="seat-status"><strong>{m.label}</strong>{hardware && ['safe','warning','emergency','analyzing'].includes(state) ? <span>HR {telemetry.hr} · RR {telemetry.rr} · LIVE</span> : completed ? <span>Session saved · Tap to review</span> : <span>{m.hint}</span>}</div></button>;
}

function SeatsScreen({ assignments, people, hardwareSeat, monitoring, onAssign, onHardware, onStart }: any) {
  return <div className="page scroll-page"><header className="page-title"><span className="eyebrow">SEAT SETUP</span><h2>Who's riding?</h2><p>Assign passengers, confirm consent, and link the SafeSeat prototype sensor.</p></header>
    <section className="car-card"><div className="windshield">FRONT</div><div className="seat-map front"><SeatTile n={1}/><SeatTile n={2}/></div><div className="seat-map rear"><SeatTile n={3}/><SeatTile n={4}/><SeatTile n={5}/></div></section>
    <section className="panel"><div className="section-head"><div><span>SAFESEAT SENSOR</span><strong>Prototype hardware link</strong></div><span className="pill green">CONNECTED</span></div><div className="sensor-list">{assignments.filter((a:any)=>a.personId).map((a:any)=>{ const p=people.find((x:any)=>x.id===a.personId); return <button key={a.seatNo} className={`choice-row ${hardwareSeat===a.seatNo?'selected':''}`} disabled={monitoring} onClick={()=>onHardware(a.seatNo)}><span><b>{SEATS[a.seatNo-1].role}</b><small>{p?.type==='owner'?'Me':p?.name}</small></span><i>{hardwareSeat===a.seatNo?'Linked':'Link'}</i></button>})}</div></section>
    <button className="primary full sticky-action" onClick={onStart}>{monitoring ? 'Refresh Monitoring Sessions' : 'Start Monitoring'}</button>
  </div>;
  function SeatTile({n}:{n:number}) { const a=assignments.find((x:any)=>x.seatNo===n); const p=people.find((x:any)=>x.id===a?.personId); return <button className={`seat-tile ${a?.personId?'occupied':''} ${hardwareSeat===n?'linked':''}`} onClick={()=>onAssign(n)}><div className="seat-shape"><span>{p?.initials ?? '+'}</span></div><strong>{SEATS[n-1].role}</strong><small>{p ? (p.type==='owner'?'Me':p.type==='guest'?'Guest':p.name) : 'Tap to assign'}</small>{hardwareSeat===n&&<em>Sensor</em>}</button> }
}

function EveryoneScreen({ people, onAdd }: {people:Person[]; onAdd:()=>void}) {
  return <div className="page scroll-page"><header className="page-title"><span className="eyebrow">EVERYONE</span><h2>People & contacts</h2><p>Saved passenger profiles stay available across rides. Guests remain session-only.</p></header>
    <div className="section-head plain"><div><span>PASSENGER PROFILES</span><strong>{people.filter(p=>p.type!=='guest').length} saved profiles</strong></div><button className="icon-button" onClick={onAdd}><Icon name="plus"/></button></div>
    <div className="card-list">{people.filter(p=>p.type!=='guest').map(p=><div className="person-card" key={p.id}><div className="big-avatar">{p.initials}</div><div><strong>{p.type==='owner'?'Me · Account Owner':p.name}</strong><span>{p.type==='owner'?'Driver profile':'Saved passenger profile'}</span></div><Icon name="chevron" size={18}/></div>)}</div>
    <div className="section-head plain"><div><span>EMERGENCY CONTACTS</span><strong>2 contacts</strong></div></div>
    <div className="card-list"><div className="person-card"><div className="icon-avatar"><Icon name="phone"/></div><div><strong>Emergency Contact 1</strong><span>+63 917 555 0112 · Primary</span></div><span className="pill green">SMS</span></div><div className="person-card"><div className="icon-avatar"><Icon name="phone"/></div><div><strong>Emergency Contact 2</strong><span>+63 998 555 0184</span></div><span className="pill">BACKUP</span></div></div>
    <button className="secondary full" onClick={onAdd}><Icon name="plus" size={18}/> Add passenger profile</button>
  </div>;
}

function SettingsScreen({ theme,setTheme,metric,setMetric,notifications,setNotifications,history,onHistory,onHistoryList,onDiagnostics,onGuide,onHelp,onReset,onLogout }: any) {
  return <div className="page settings-page scroll-page"><header className="page-title"><span className="eyebrow">SETTINGS</span><h2>SafeSeat settings</h2></header>
    <div className="setting-shortcuts"><a href="#account">Account</a><a href="#alerts">Alerts</a><a href="#history">History</a><a href="#system">System</a></div>
    <SettingSection id="account" title="ACCOUNT"><SettingItem icon="person" title="Email" detail="demo@safeseat.app"/><SettingItem icon="phone" title="Phone" detail="+63 917 555 0101"/><SettingItem icon="shield" title="Password" detail="Change account password"/></SettingSection>
    <SettingSection id="alerts" title="ALERTS & EMERGENCY"><SettingToggle icon="bell" title="Driver Emergency SMS" detail="Send escalation messages during an emergency." checked={notifications} setChecked={setNotifications}/><SettingItem icon="users" title="Profiles & Emergency Contacts" detail="Manage saved passengers and SMS contacts"/></SettingSection>
    <SettingSection id="history" title="MONITORING & HISTORY"><button className="setting-item clickable history-entry" onClick={onHistoryList}><div className="setting-icon"><Icon name="history"/></div><div><strong>Session History</strong><span>{history.length ? `${history.length} completed session${history.length===1?'':'s'} · Tap to browse` : 'No completed sessions yet'}</span></div><Icon name="chevron" size={18}/></button>{history.slice(0,3).map((s:HistorySession)=><button key={s.id} className="mini-history" onClick={()=>onHistory(s)}><span><b>{s.personName}</b><small>{SEATS[s.seatNo-1].role} · {s.durationMin} min · {formatDate(s.endedAt)}</small></span><Icon name="chevron" size={16}/></button>)}</SettingSection>
    <SettingSection id="system" title="SYSTEM & DISPLAY"><SettingToggle icon="moon" title="Light Mode" detail="Use the high-contrast light appearance." checked={theme==='light'} setChecked={(v:boolean)=>setTheme(v?'light':'dark')}/><SettingToggle icon="info" title="Use Metric Units" detail="Show temperature in Celsius." checked={metric} setChecked={setMetric}/><SettingItem icon="sensor" title="System Diagnostic" detail="View sensor status and demo controls" onClick={onDiagnostics}/><SettingItem icon="shield" title="SafeSeat Guide" detail="Review the monitoring workflow" onClick={onGuide}/><SettingItem icon="info" title="Quick Help" detail="Demo notes and presentation tips" onClick={onHelp}/></SettingSection>
    <SettingSection title="SESSION & ACCOUNT"><SettingItem icon="x" title="Reset Demo Data" detail="Restore the original browser demonstration state" danger onClick={onReset}/><SettingItem icon="logout" title="Log out" detail="Return to the SafeSeat demo sign-in" danger onClick={onLogout}/></SettingSection>
  </div>;
}
function SettingSection({title,id,children}:{title:string;id?:string;children:any}) { return <section className="settings-section" id={id}><h3>{title}</h3><div className="settings-card">{children}</div></section> }
function SettingItem({icon,title,detail,onClick,danger}:{icon:string;title:string;detail:string;onClick?:()=>void;danger?:boolean}) { const Tag:any=onClick?'button':'div'; return <Tag className={`setting-item ${onClick?'clickable':''} ${danger?'danger':''}`} onClick={onClick}><div className="setting-icon"><Icon name={icon}/></div><div><strong>{title}</strong><span>{detail}</span></div>{onClick&&<Icon name="chevron" size={18}/>}</Tag> }
function SettingToggle({icon,title,detail,checked,setChecked}:any) { return <div className="setting-item"><div className="setting-icon"><Icon name={icon}/></div><div><strong>{title}</strong><span>{detail}</span></div><button className={`switch ${checked?'on':''}`} onClick={()=>setChecked(!checked)}><i/></button></div> }

function BottomTabs({tab,setTab}:{tab:Tab;setTab:(t:Tab)=>void}) { const items:[Tab,string,string][]=[['home','home','Home'],['seats','car','Seats'],['everyone','users','Everyone'],['settings','settings','Settings']]; return <nav className="bottom-tabs">{items.map(([id,icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon name={icon}/><span>{label}</span>{tab===id&&<i/>}</button>)}</nav> }

function ModalLayer({children,onClose,modal}:{children:any;onClose:()=>void;modal:Modal}) { const sheet = ['end','assign','consent','add-profile'].includes(modal.type); return <div className="modal-backdrop" onMouseDown={(e: any)=>{if(e.currentTarget===e.target)onClose()}}><section className={`modal-card ${sheet?'sheet':''}`}><button className="close-button" onClick={onClose}><Icon name="x" size={19}/></button>{children}</section></div> }

function LiveDetail({seatNo,person,telemetry,demoState,onState,onEnd}:any) { const state = demoState==='safe'?'NORMAL':demoState==='warning'?'VERIFYING':'EMERGENCY'; return <div className="modal-content"><span className="eyebrow">LIVE MONITORING</span><h2>{SEATS[seatNo-1].role}</h2><p className="modal-sub">{person?.type==='owner'?'Me':person?.name} · <span className="live-dot">● LIVE</span></p><div className="vital-grid"><Metric icon="heart" label="Heart rate" value={`${telemetry.hr} bpm`}/><Metric icon="lungs" label="Respiration" value={`${telemetry.rr} /min`}/><Metric icon="temp" label="Surface temp." value={`${telemetry.temp} °C`}/></div><div className="detail-list"><Row label="Seat occupancy" value={telemetry.occupied?'Detected':'Not detected'}/><Row label="Movement activity" value={telemetry.movement}/><Row label="Camera verification" value={telemetry.camera}/><Row label="SafeSeat state" value={state} accent/></div><div className="demo-controls"><span>DEMO STATE</span><div>{(['safe','warning','emergency'] as DemoState[]).map(s=><button key={s} className={demoState===s?'active':''} onClick={()=>onState(s)}>{s.toUpperCase()}</button>)}</div></div><button className="danger-button full" onClick={onEnd}>End this seat's session</button></div> }
function Metric({icon,label,value}:any) { return <div className="metric"><Icon name={icon}/><span>{label}</span><strong>{value}</strong></div> }
function Row({label,value,accent}:any) { return <div className="detail-row"><span>{label}</span><strong className={accent?'accent':''}>{value}</strong></div> }

function EndSessions({activeSeats,people,assignments,activeStarted,onEnd,onEndAll}:any) { return <div className="modal-content"><span className="eyebrow">END A SESSION</span><h2>Who is getting off?</h2><p className="modal-sub">End one passenger's session without stopping the others.</p><div className="end-list">{activeSeats.map((a:any)=>{const p=people.find((x:any)=>x.id===a.personId); const mins=Math.max(1,Math.floor((Date.now()-(activeStarted[a.seatNo]??Date.now()))/60000)); return <div className="end-row" key={a.seatNo}><div><strong>{SEATS[a.seatNo-1].role}</strong><span>{p?.type==='owner'?'Me':p?.type==='guest'?'Guest':p?.name} · {mins} min</span></div><button onClick={()=>onEnd(a.seatNo)}>End</button></div>})}{activeSeats.length===0&&<div className="empty-state">No active passenger sessions.</div>}</div>{activeSeats.length>1&&<button className="secondary full" onClick={onEndAll}>End all active sessions</button>}</div> }

function SessionSummary({session,onDetail,onDismiss}:{session:HistorySession;onDetail:()=>void;onDismiss:()=>void}) { return <div className="modal-content"><span className="eyebrow">SESSION SAVED</span><h2>Session Summary</h2><p className="modal-sub">{session.personName} · {SEATS[session.seatNo-1].role}<br/>{formatTime(session.startedAt)} – {formatTime(session.endedAt)} · {session.durationMin} min</p><div className="summary-result"><Icon name="shield"/><div><strong>{session.outcome}</strong><span>{session.emergencyEvents?'Emergency escalation was recorded.':'Session data is available in Monitoring & History.'}</span></div></div><div className="stat-grid"><Stat label="Avg HR" value={`${session.hrAvg} bpm`}/><Stat label="Avg RR" value={`${session.rrAvg}/min`}/><Stat label="Surface temp" value={`${session.tempAvg}°C`}/><Stat label="Events" value={`${session.warningEvents+session.emergencyEvents}`}/></div><button className="primary full" onClick={onDetail}>See Session Detail</button><button className="text-button" onClick={onDismiss}>Dismiss and free this seat</button></div> }
function Stat({label,value}:any){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}


function HistoryList({history,onOpen}:{history:HistorySession[];onOpen:(s:HistorySession)=>void}) {
  return <div className="modal-content"><span className="eyebrow">MONITORING & HISTORY</span><h2>Session History</h2><p className="modal-sub">Completed passenger sessions are stored locally in this web demo.</p><div className="history-list-full">{history.length ? history.map(s=><button key={s.id} className="history-full-row" onClick={()=>onOpen(s)}><div><strong>{s.personName}</strong><span>{SEATS[s.seatNo-1].role} · {formatDate(s.endedAt)}</span><small>{formatTime(s.startedAt)} – {formatTime(s.endedAt)} · {s.durationMin} min</small></div><div><b>{s.outcome}</b><Icon name="chevron" size={17}/></div></button>) : <div className="history-empty"><div className="setting-icon"><Icon name="history"/></div><strong>No completed sessions yet</strong><span>End a passenger seat session from Home and it will appear here.</span></div>}</div></div>
}
function SessionDetail({session}:{session:HistorySession}) { return <div className="modal-content session-detail"><span className="eyebrow">SESSION DETAIL</span><h2>{session.personName}</h2><p className="modal-sub">{SEATS[session.seatNo-1].role} · {formatDate(session.endedAt)}<br/>{formatTime(session.startedAt)} – {formatTime(session.endedAt)} · {session.durationMin} min</p><div className="history-chart"><span>HEART RATE TREND</span><Spark values={[session.hrMin,session.hrAvg-3,session.hrAvg+2,session.hrAvg-1,session.hrMax-4,session.hrAvg]}/><div><b>Min {session.hrMin}</b><b>Avg {session.hrAvg}</b><b>Max {session.hrMax} bpm</b></div></div><div className="history-chart"><span>RESPIRATION TREND</span><Spark values={[session.rrMin,session.rrAvg-.8,session.rrAvg+.7,session.rrAvg-.2,session.rrMax-.6,session.rrAvg]}/><div><b>Min {session.rrMin}</b><b>Avg {session.rrAvg}</b><b>Max {session.rrMax}/min</b></div></div><div className="history-chart compact"><span>SURFACE TEMPERATURE</span><div className="range-row"><b>{session.tempMin}°</b><i></i><b>{session.tempAvg}° avg</b><i></i><b>{session.tempMax}°</b></div></div><div className="detail-list"><Row label="Movement events" value={session.movementEvents}/><Row label="Verification events" value={session.verificationEvents}/><Row label="Warning events" value={session.warningEvents}/><Row label="Emergency events" value={session.emergencyEvents}/></div><div className="timeline"><span>EVENT TIMELINE</span><Timeline time={formatTime(session.startedAt)} text="Monitoring started"/><Timeline time={formatTime(session.startedAt+Math.max(1,session.durationMin*.45)*60000)} text={session.warningEvents?'Movement detected · verification requested':'Normal monitoring continued'}/><Timeline time={formatTime(session.endedAt)} text="Passenger session ended"/></div></div> }
function Spark({values}:{values:number[]}) { const min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min); const pts=values.map((v,i)=>`${(i/(values.length-1))*100},${30-((v-min)/range)*25}`).join(' '); return <svg className="spark" viewBox="0 0 100 34" preserveAspectRatio="none"><polyline points={pts}/></svg> }
function Timeline({time,text}:{time:string;text:string}) { return <div className="timeline-row"><b>{time}</b><i></i><span>{text}</span></div> }

function AssignModal({seatNo,people,onAssign,onClear}:any) { return <div className="modal-content"><span className="eyebrow">ASSIGN SEAT</span><h2>{SEATS[seatNo-1].role}</h2><p className="modal-sub">Choose who is sitting in this seat.</p><div className="assign-list">{people.filter((p:Person)=>p.type!=='owner'||seatNo===1).map((p:Person)=><button key={p.id} onClick={()=>onAssign(p.id)}><span className="big-avatar small">{p.initials}</span><span><strong>{p.type==='owner'?'Me · Account Owner':p.type==='guest'?'Guest Passenger':p.name}</strong><small>{p.type==='guest'?'Session-only profile':'Saved profile'}</small></span><Icon name="chevron" size={17}/></button>)}</div><button className="text-button danger-text" onClick={onClear}>Clear this seat</button></div> }
function ConsentModal({person,onConfirm,onDecline}:any) { return <div className="modal-content"><span className="eyebrow">MONITORING CONSENT</span><h2>Confirm passenger consent</h2><p className="modal-sub">{person.type==='guest'?'Guest Passenger':person.name} must agree before SafeSeat starts monitoring this seat.</p><div className="consent-box"><Icon name="shield"/><p>SafeSeat processes sensor readings to identify unusual safety states. Camera verification is event-based; the demo does not save camera images.</p></div><button className="primary full" onClick={onConfirm}>Passenger agrees</button><button className="secondary full" onClick={onDecline}>Decline monitoring</button></div> }
function AddProfile({onAdd}:{onAdd:(name:string)=>void}) { const [name,setName]=useState(''); return <div className="modal-content"><span className="eyebrow">NEW PROFILE</span><h2>Add passenger</h2><label>Full name<input value={name} onChange={(e: any)=>setName(e.target.value)} placeholder="Passenger name"/></label><button className="primary full" disabled={!name.trim()} onClick={()=>onAdd(name.trim())}>Save profile</button></div> }
function Diagnostics({telemetry,demoState,onState}:any) { return <div className="modal-content"><span className="eyebrow">SYSTEM DIAGNOSTIC</span><h2>SafeSeat hardware</h2><p className="modal-sub">Browser demo emulates the current prototype sensor status.</p><div className="diagnostic-list"><Diag title="C1001 mmWave" detail={`HR ${telemetry.hr} bpm · RR ${telemetry.rr}/min`} status="Operational"/><Diag title="MLX90614" detail={`Surface ${telemetry.temp} °C`} status="Operational"/><Diag title="FSR seat pressure" detail="Occupancy detected" status="Operational"/><Diag title="MPU movement" detail={telemetry.movement} status="Operational"/><Diag title="Event camera" detail={telemetry.camera} status="Standby"/></div><div className="demo-controls large"><span>DEMO CONDITION</span><p>Use these controls during a presentation to demonstrate state changes without hardware.</p><div>{(['safe','warning','emergency'] as DemoState[]).map(s=><button key={s} className={demoState===s?'active':''} onClick={()=>onState(s)}>{s.toUpperCase()}</button>)}</div></div></div> }
function Diag({title,detail,status}:any){return <div className="diag"><div className="diag-icon"><Icon name="sensor"/></div><div><strong>{title}</strong><span>{detail}</span></div><b>{status}</b></div>}
function Guide(){return <div className="modal-content"><span className="eyebrow">SAFESEAT GUIDE</span><h2>Monitoring workflow</h2><div className="guide-steps"><GuideStep n="1" title="Assign seats" text="Choose who is riding and confirm passenger monitoring consent."/><GuideStep n="2" title="Link prototype sensor" text="Choose the seat physically fitted with the SafeSeat sensor hardware."/><GuideStep n="3" title="Start monitoring" text="Home shows live HR/RR and sensor freshness while the ride continues."/><GuideStep n="4" title="End per passenger" text="When someone gets off, end only that seat. Other passenger sessions continue."/><GuideStep n="5" title="Review history" text="Completed sessions are saved under Monitoring & History."/></div></div>}
function GuideStep({n,title,text}:any){return <div className="guide-step"><i>{n}</i><div><strong>{title}</strong><span>{text}</span></div></div>}
function Help(){return <div className="modal-content"><span className="eyebrow">QUICK HELP</span><h2>Web demo notes</h2><div className="help-card"><strong>What is simulated?</strong><p>The browser cannot connect to your ESP32/Main Hub using the native Expo implementation, so the live sensor feed is a controlled demo simulator.</p></div><div className="help-card"><strong>What stays equivalent?</strong><p>Five-seat Home layout, assignments, per-seat sessions, live details, Session History, settings, consent flow, themes, and Warning/Emergency presentation behavior.</p></div><div className="help-card"><strong>For defense</strong><p>Use Settings → System Diagnostic to switch the demo condition between SAFE, WARNING, and EMERGENCY.</p></div></div>}

export default App;
