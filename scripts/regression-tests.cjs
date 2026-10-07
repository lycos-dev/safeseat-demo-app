// Unit tests use the project's TypeScript compiler; no extra test package is required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, console,
    require: (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id),
  }, { filename });
  return module.exports;
}

const { getSeatDisplayState: state } = load('src/utils/monitoring-presentation.ts');

test('unsaved-edit guard lets Stay cancel and resumes the exact back action on Discard', () => {
  let prevention, buttons;
  const events = [];
  const { useUnsavedChangesGuard } = load('src/hooks/use-unsaved-changes-guard.ts', {
    'expo-router': { useNavigation: () => ({ dispatch: action => events.push(action) }) },
    'expo-router/react-navigation': { usePreventRemove: (enabled, callback) => { prevention = { enabled, callback }; } },
    'react-native': {
      Alert: { alert: (_title, _message, actions) => { buttons = actions; } },
      Keyboard: { dismiss: () => events.push('dismiss-keyboard') },
    },
  });
  useUnsavedChangesGuard(false);
  assert.equal(prevention.enabled, false);
  useUnsavedChangesGuard(true);
  assert.equal(prevention.enabled, true);
  for (const type of ['GO_BACK', 'POP', 'RESET']) {
    events.length = 0;
    const action = { type, source: 'profile', target: 'everyone-stack', payload: { count: 1 } };
    prevention.callback({ data: { action } });
    const stay = buttons.find(button => button.text === 'Stay');
    assert.equal(stay.style, 'cancel');
    stay.onPress?.();
    assert.equal(events.length, 0);
    buttons.find(button => button.text === 'Discard').onPress();
    assert.equal(events[0], 'dismiss-keyboard');
    assert.equal(events[1], action);
    assert.equal(events.length, 2);
  }
  useUnsavedChangesGuard(false);
  assert.equal(prevention.enabled, false);
});

const accountUser = { uid: 'owner', email: 'owner@example.com', displayName: 'Owner', phoneNumber: null, metadata: { creationTime: '2026-01-01T00:00:00Z' } };
function profileStore(initial, failure) {
  let data = initial, writes = 0;
  const { saveUserProfile } = load('src/services/user-profile.ts', {
    '../firebase': { db: {} },
    'firebase/firestore': {
      doc: (_db, ...parts) => parts.join('/'),
      runTransaction: async (_db, callback) => {
        let pending;
        const result = await callback({
          get: async ref => {
            assert.equal(ref, 'users/owner');
            return { exists: () => data !== undefined, data: () => data };
          },
          set: (_ref, patch, options) => {
            assert.equal(options.merge, true);
            pending = { ...data, ...patch };
          },
        });
        if (failure) throw failure;
        if (pending) { data = pending; writes++; }
        return result;
      },
    },
  });
  return { saveUserProfile, data: () => data, writes: () => writes };
}

test('login repairs a missing user document and repeated repair preserves health data', async () => {
  const store = profileStore();
  await store.saveUserProfile(accountUser);
  assert.equal(store.data().name, 'Owner');
  assert.equal(store.data().email, accountUser.email);
  assert.equal(store.data().createdAt, '2026-01-01T00:00:00.000Z');
  await store.saveUserProfile(accountUser, { heightCm: 180, phone: '+639123456789' });
  await store.saveUserProfile(accountUser);
  assert.equal(store.data().heightCm, 180);
  assert.equal(store.data().phone, '+639123456789');
  assert.equal(store.writes(), 2);
});

test('phone save creates a missing profile and profile edits preserve existing contact details', async () => {
  const store = profileStore();
  await store.saveUserProfile(accountUser, { phone: '+639123456789' });
  await store.saveUserProfile(accountUser, { name: 'New name', email: 'stale@example.com' });
  assert.equal(store.data().phone, '+639123456789');
  assert.equal(store.data().email, accountUser.email);
  assert.equal(store.data().name, 'New name');
});

test('profile repair preserves existing fields and syncs the Auth email', async () => {
  const store = profileStore({ name: 'Saved name', phone: '09123456789', createdAt: 'old', bloodType: 'a+', email: 'old@example.com' });
  await store.saveUserProfile(accountUser);
  assert.equal(store.data().name, 'Saved name');
  assert.equal(store.data().createdAt, 'old');
  assert.equal(store.data().bloodType, 'a+');
  assert.equal(store.data().email, accountUser.email);
});

test('denied profile writes propagate without claiming persistence', async () => {
  const failure = { code: 'permission-denied' };
  const store = profileStore(undefined, failure);
  await assert.rejects(store.saveUserProfile(accountUser, { phone: '09123456789' }), error => error === failure);
  assert.equal(store.data(), undefined);
});

function authScreen(screen, firebaseAuth, saveUserProfile) {
  const h = harness(), alerts = [], routes = [], flags = [];
  const auth = { currentUser: null };
  const errors = load('src/utils/account-errors.ts');
  const mocks = {
    ...h.mocks,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { StyleSheet: { create: x => x }, Platform: { OS: 'android' }, Alert: { alert: (...args) => alerts.push(args) } },
    'react-native-safe-area-context': {},
    'expo-router': { useRouter: () => ({ replace: route => routes.push(route) }), useLocalSearchParams: () => ({}) },
    'expo-status-bar': {}, 'expo-haptics': { notificationAsync: async () => {}, NotificationFeedbackType: {} },
    'expo-secure-store': { setItemAsync: async (...args) => flags.push(args) },
    '@expo/ui': { Icon: { select: value => value.android } }, '@expo/material-symbols/visibility.xml': {}, '@expo/material-symbols/visibility_off.xml': {},
    '@/constants/theme': { Spacing: {} }, '@/components/auth-background': 'Background',
    '@/components/button': 'Button', '@/components/text-input': 'TextInput',
    '../../firebase': { auth }, 'firebase/auth': firebaseAuth(auth),
    '@/services/local-storage': { setLocalValue: async (...args) => { flags.push(args); }, getLocalValue: async () => null, deleteLocalValue: async () => {} },
    '@/services/user-profile': { saveUserProfile }, '@/utils/account-errors': errors,
  };
  const Component = load(`src/app/(auth)/${screen}.tsx`, mocks).default;
  let tree;
  const render = () => { tree = h.render(() => ({ value: Component() })); };
  const find = predicate => {
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      if (predicate(node)) return node;
      for (const child of [node.props?.children].flat(Infinity)) { const found = walk(child); if (found) return found; }
    };
    const node = walk(tree); assert.ok(node, 'Expected screen control'); return node.props;
  };
  render();
  return { auth, alerts, routes, flags, render, find,
    fill: (placeholder, text) => { find(n => n.props?.placeholder === placeholder).onChangeText(text); render(); },
    submit: () => find(n => n.type === 'Button' && n.props.loading !== undefined).onPress(),
    settle: async () => { await new Promise(resolve => setImmediate(resolve)); render(); },
  };
}

test('signup retries failed profile setup without recreating Auth; rapid taps submit once', async () => {
  let creates = 0, saves = 0;
  const screen = authScreen('signup', auth => ({
    createUserWithEmailAndPassword: async () => { creates++; auth.currentUser = accountUser; return { user: accountUser }; },
    updateProfile: async () => {},
  }), async () => { if (++saves === 1) throw { code: 'unavailable' }; });
  screen.fill('Full name', 'Owner'); screen.fill('name@example.com', accountUser.email);
  screen.fill('At least 6 characters', 'password'); screen.fill('Re-enter your password', 'password');
  screen.submit(); screen.submit(); await screen.settle();
  assert.equal(creates, 1); assert.equal(saves, 1);
  assert.equal(screen.flags.length, 0); assert.equal(screen.routes.length, 0);
  assert.match(screen.alerts[0][0], /setup incomplete/);
  screen.submit(); await screen.settle();
  assert.equal(creates, 1); assert.equal(saves, 2);
  assert.equal(screen.flags[0][1], 'true'); assert.equal(screen.routes[0], '/(tabs)/home');
});

test('duplicate-email signup offers login and never writes an existing account profile', async () => {
  let saves = 0;
  const screen = authScreen('signup', () => ({
    createUserWithEmailAndPassword: async () => { throw { code: 'auth/email-already-in-use' }; },
  }), async () => { saves++; });
  screen.fill('Full name', 'Owner'); screen.fill('name@example.com', accountUser.email);
  screen.fill('At least 6 characters', 'password'); screen.fill('Re-enter your password', 'password');
  screen.submit(); await screen.settle();
  assert.equal(saves, 0); assert.equal(screen.flags.length, 0);
  assert.equal(screen.alerts[0][0], 'Account already exists');
  screen.alerts[0][2].find(button => button.text === 'Log in').onPress();
  assert.equal(screen.routes[0].params.email, accountUser.email);
});

test('login waits for profile repair before activating the app session', async () => {
  let fail = true;
  const screen = authScreen('login', () => ({ signInWithEmailAndPassword: async () => ({ user: accountUser }) }),
    async () => { if (fail) throw { code: 'permission-denied' }; });
  screen.fill('name@example.com', accountUser.email); screen.fill('Enter your password', 'password');
  screen.submit(); await screen.settle();
  assert.equal(screen.alerts[0][0], 'Profile setup incomplete');
  assert.equal(screen.flags.length, 0); assert.equal(screen.routes.length, 0);
  fail = false; screen.submit(); await screen.settle();
  assert.equal(screen.flags.length, 1); assert.equal(screen.routes[0], '/(tabs)/home');
});
const readySeat = { assigned: true, ownerDriver: false, consent: 'confirmed', linked: true, connected: true, ready: true, active: true, liveState: 'safe' };

test('only the physically linked consenting seat can report live states', () => {
  for (const liveState of ['safe', 'warning', 'emergency', 'unknown']) {
    assert.equal(state({ ...readySeat, liveState }), liveState);
    assert.equal(state({ ...readySeat, linked: false, liveState }), 'assigned');
    assert.equal(state({ ...readySeat, consent: undefined, liveState }), 'consent');
    assert.equal(state({ ...readySeat, consent: 'declined', liveState }), 'declined');
  }
});
test('offline and warm-up override stale live readings', () => {
  assert.equal(state({ ...readySeat, connected: false, liveState: 'safe' }), 'offline');
  assert.equal(state({ ...readySeat, ready: false, liveState: 'emergency' }), 'offline');
  assert.equal(state({ ...readySeat, active: false }), 'ready');
  assert.equal(state({ ...readySeat, assigned: false }), 'empty');
});
test('only the signed-in owner in Driver may skip extra consent', () => {
  assert.equal(state({ ...readySeat, ownerDriver: true, consent: undefined }), 'safe');
  assert.equal(state({ ...readySeat, ownerDriver: false, consent: undefined }), 'consent');
});
// A deterministic hook harness tests the real context callbacks and persistence.
// It does not substitute for native device testing or React integration tests.
function harness() {
  let cursor = 0;
  const slots = [], effects = [];
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState: initial => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef: initial => { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useMemo: fn => fn(), useCallback: fn => fn,
    useEffect: (fn, deps) => {
      const i = cursor++;
      if (!(i in slots) || !deps || deps.some((v, n) => v !== slots[i]?.[n])) effects.push(fn);
      slots[i] = deps;
    },
  };
  return { mocks: { react, 'react/jsx-runtime': { jsx: (_type, props) => props } },
    render: Component => { cursor = 0; return Component({ children: null }).value; },
    effects: async () => { while (effects.length) effects.shift()(); await new Promise(resolve => setImmediate(resolve)); },
  };
}

test('guide skips the hidden selector and retains consent checks', () => {
  for (const indicator of [true, false]) {
    const h = harness(); let prototypeIndicator = indicator;
    const { DriverGuideProvider: Provider } = load('src/hooks/driver-guide-context.tsx', {
      ...h.mocks, '@/firebase': { auth: { currentUser: { uid: 'test' } } },
      'firebase/auth': { onAuthStateChanged: () => () => {} },
      'expo-router': { useRouter: () => ({ replace() {} }), usePathname: () => '/assign' },
      '@react-native-async-storage/async-storage': {},
      '@/hooks/user-preferences-context': { useUserPreferences: () => ({ prototypeIndicator }) },
    });
    let value = h.render(Provider); value.startGuide();
    value = h.render(Provider); assert.equal(value.stepId, 'welcome'); value.beginInteractiveGuide();
    value = h.render(Provider); value.recordTabOpened('assign');
    value = h.render(Provider); value.recordSeatTapped(2, 'assign');
    value = h.render(Provider); value.recordAssignmentSaved(2, true);
    value = h.render(Provider); assert.equal(value.stepId, 'consent'); value.recordConsentConfirmed(2);
    value = h.render(Provider); assert.equal(value.stepId, indicator ? 'sensor' : 'start');
    if (indicator) {
      assert.match(value.step.actionHint, /SafeSeat Sensor/);
      value.recordSensorSelected(3, true);
      value = h.render(Provider); assert.equal(value.stepId, 'consent'); value.recordConsentConfirmed(3);
      value = h.render(Provider); value.recordSensorSelected(3, false);
    }
    value = h.render(Provider); assert.equal(value.stepId, 'start'); value.recordMonitoringStarted();
    value = h.render(Provider); assert.equal(value.stepId, 'alerts'); value.recordLiveSeatOpened(3);
    value = h.render(Provider); assert.equal(value.stepId, 'complete');
  }
});

test('hiding the selector during its guide step advances to Start', async () => {
  const h = harness(); let prototypeIndicator = true;
  const { DriverGuideProvider: Provider } = load('src/hooks/driver-guide-context.tsx', {
    ...h.mocks, '@/firebase': { auth: { currentUser: { uid: 'test' } } },
    'firebase/auth': { onAuthStateChanged: () => () => {} },
    'expo-router': { useRouter: () => ({ replace() {} }), usePathname: () => '/home' },
    '@react-native-async-storage/async-storage': { getItem: async () => 'true' },
    '@/hooks/user-preferences-context': { useUserPreferences: () => ({ prototypeIndicator }) },
  });
  let v = h.render(Provider); await h.effects();
  v = h.render(Provider); v.beginInteractiveGuide();
  v = h.render(Provider); v.recordTabOpened('assign');
  v = h.render(Provider); v.recordSeatTapped(1, 'sensor');
  v = h.render(Provider); assert.equal(v.stepId, 'sensor');
  prototypeIndicator = false; h.render(Provider); await h.effects();
  v = h.render(Provider); assert.equal(v.stepId, 'start');
});

test('Seats completely removes the selector when the indicator is off', () => {
  const palette = load('src/constants/theme.ts', { '@/global.css': {}, 'react-native': { Platform: { select: x => x.default } } });
  for (const prototypeIndicator of [true, false]) {
    const h = harness();
    const native = { StyleSheet: { create: x => x, absoluteFill: {} }, useWindowDimensions: () => ({ width: 390, height: 844 }) };
    for (const name of ['View','Text','Pressable','ScrollView','Image','ImageBackground','Modal']) native[name] = name;
    const mocks = {
      ...h.mocks, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
      'expo-router': { useRouter: () => ({}), useFocusEffect() {} }, 'expo-haptics': {}, 'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
      '@react-native-async-storage/async-storage': {}, '@/constants/theme': palette,
      '@/hooks/use-theme': { useTheme: () => palette.DarkTheme },
      '@/hooks/user-preferences-context': { useUserPreferences: () => ({ prototypeIndicator }) },
      '@/hooks/driver-guide-context': { useDriverGuide: () => ({ isStep: () => false }) },
      '@/hooks/safeseat-hub-context': { useSafeSeatHub: () => ({ connected: false, telemetryReady: false }) },
      '@/hooks/seat-session-context': { useSeatSessions: () => ({ activeSessions: {}, startSeatSessions: async () => {} }) },
      '@/utils/monitoring-presentation': { getSeatDisplayState: state },
      '@/services/admin-cloud-sync': { endCurrentCloudSession: async () => {} },
      '../../../../assets/images/appImgs/car-cropped.png': 'car.png',
    };
    for (const name of ['button','assign-card','assign-seat-modal','seat-options-modal','guide-pulse-overlay']) mocks[`@/components/${name}`] = name;
    const { default: Assign } = load('src/app/(tabs)/assign/index.tsx', mocks);
    const tree = Assign();
    const json = JSON.stringify(tree);
    assert.equal(json.includes('SafeSeat Sensor. Choose the seat connected to the hardware'), prototypeIndicator);
    assert.equal(json.includes('Monitored seat:'), false);
  }
});

test('old preferences default the indicator on; rapid changes persist together and survive reload', async () => {
  const store = new Map([['userPreferences', JSON.stringify({ themeMode: 'light' })]]);
  const storage = { getItem: async key => store.get(key) ?? null, setItem: async (key, value) => { store.set(key, value); } };
  const create = () => {
    const h = harness();
    const { UserPreferencesProvider: Provider } = load('src/hooks/user-preferences-context.tsx', {
      ...h.mocks, '@react-native-async-storage/async-storage': storage,
      '../firebase': { auth: { currentUser: null }, db: {} }, 'firebase/firestore': {},
    });
    return { h, Provider };
  };
  let { h, Provider } = create(); h.render(Provider); await h.effects();
  let value = h.render(Provider); assert.equal(value.prototypeIndicator, true); assert.equal(value.themeMode, 'light');
  await Promise.all([value.setPrototypeIndicator(false), value.setThemeMode('dark'), value.setUseMetric(false)]);
  const saved = JSON.parse(store.get('userPreferences'));
  assert.equal(saved.prototypeIndicator, false); assert.equal(saved.themeMode, 'dark'); assert.equal(saved.useMetric, false);
  ({ h, Provider } = create()); h.render(Provider); await h.effects(); value = h.render(Provider);
  assert.equal(value.prototypeIndicator, false); assert.equal(value.useMetric, false);
});
