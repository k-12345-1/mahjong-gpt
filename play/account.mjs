/* An account, so where you left off follows you rather than the browser.
   What it carries is exactly what the game already saves on its own: the table mid-hand,
   the lesson you reached, the sound level. Nothing about how you played, no name, no
   anything else -- there is nothing else to carry.
   Signed out, or with no project behind it, every function here does nothing and the
   game is the game it was: the saves stay local and the menu shows no account at all. */

/* The project this talks to. The publishable key belongs in the page -- that is what it
   is for; it carries no rights of its own, because every row is reached through a policy
   comparing auth.uid() to the row's owner, and anon has no policy at all. */
const PROJECT = '';
const PUBLISHABLE = '';
export const configured = Boolean(PROJECT && PUBLISHABLE);

/* The three keys worth carrying, under the names the game already stores them by. The
   value sent is the string itself, so what comes back can go straight back in. */
const CARRIED = ['mahjong-table-v1', 'mahjong-school', 'mahjong-volume'];
const SESSION = 'mahjong-account';
/* the one reload a pull is allowed, so a table being played on another device at the
   same time cannot bounce this one round in a loop */
const PULLED = 'mahjong-account-pulled';

let session = null;
try { session = JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch { /* no store */ }

async function call(path, { method = 'POST', query = '', body, token, keepalive } = {}) {
  const res = await fetch(PROJECT + path + query, {
    method, keepalive,
    headers: {
      apikey: PUBLISHABLE,
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error_description || data?.msg || data?.message || res.statusText);
  }
  return data;
}

function hold(fresh) {
  session = fresh && fresh.access_token ? {
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token,
    /* a minute early, so a request never goes out on a token that expires in flight */
    expires_at: Date.now() + ((fresh.expires_in || 3600) - 60) * 1000,
    email: fresh.user?.email || session?.email || '',
  } : null;
  try {
    if (session) localStorage.setItem(SESSION, JSON.stringify(session));
    else localStorage.removeItem(SESSION);
  } catch { /* no store, and the session simply lasts the page */ }
  paint();
}

async function token() {
  if (!session) return null;
  if (Date.now() < session.expires_at) return session.access_token;
  try {
    hold(await call('/auth/v1/token', { query: '?grant_type=refresh_token',
                                        body: { refresh_token: session.refresh_token } }));
  } catch { hold(null); }   /* the session is over; the game is still perfectly playable */
  return session?.access_token || null;
}

/* ---- carrying it both ways ------------------------------------------------------- */

let pending = {}, timer;

/* Called beside each local save. The table saves on every one of your turns and none of
   those is worth a request of its own, so they gather for a second and a half and go up
   together. Losing the last of them costs the table, which the next save replaces. */
export function push(key) {
  if (!session || !CARRIED.includes(key)) return;
  let value;
  try { value = localStorage.getItem(key); } catch { return; }
  /* nothing saved under it on this browser yet, and a null sent up would land on top of
     whatever the phone had put there */
  if (value === null) return;
  pending[key] = value;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

async function flush(keepalive) {
  const patch = pending;
  pending = {};
  if (!Object.keys(patch).length) return;
  const bearer = await token();
  if (!bearer) return;
  try { await call('/rest/v1/rpc/save_state', { body: { patch }, token: bearer, keepalive }); }
  catch { /* offline, or signed out underneath: the local save already happened */ }
}

/* Leaving the page is the one moment the wait cannot be afforded, and keepalive is what
   lets the request outlive the document. */
addEventListener('pagehide', () => { clearTimeout(timer); flush(true); });

async function pull() {
  const bearer = await token();
  if (!bearer) return false;
  const rows = await call('/rest/v1/saves', { method: 'GET', query: '?select=state', token: bearer });
  const state = rows?.[0]?.state || {};
  let moved = false;
  for (const key of CARRIED) {
    const value = state[key];
    if (typeof value !== 'string' || localStorage.getItem(key) === value) continue;
    try { localStorage.setItem(key, value); moved = true; } catch { /* no store */ }
  }
  return moved;
}

/* Each screen reads its own saved state as it mounts, and it has already mounted by the
   time this answers. Starting the page again is the whole of the plumbing that would
   otherwise be needed to tell three modules their world changed under them. */
function land() {
  try {
    if (sessionStorage.getItem(PULLED)) return;
    sessionStorage.setItem(PULLED, '1');
  } catch { /* no store: pull once and accept the small chance of a second reload */ }
  location.reload();
}

/* ---- the block at the foot of the menu -------------------------------------------- */

let box;

const SAY = {
  in: 'SIGN IN', join: 'MAKE ONE', out: 'SIGN OUT',
  gone: 'DELETE ACCOUNT', sure: 'DELETE FOR GOOD?',
};

function paint() {
  if (!box) return;
  box.classList.toggle('on', Boolean(session));
  box.querySelector('.account-who').textContent =
    session ? session.email : 'CARRY YOUR GAME BETWEEN DEVICES';
  box.querySelector('[data-account=gone]').textContent = SAY.gone;
}

function says(text, bad) {
  const line = box.querySelector('.account-say');
  line.textContent = text || '';
  line.classList.toggle('bad', Boolean(bad));
}

async function tries(button, work) {
  button.disabled = true;
  says('');
  try { await work(); }
  catch (e) { says(e.message, true); }
  finally { button.disabled = false; }
}

export function mountAccount(menu) {
  if (!configured) return;
  box = document.createElement('div');
  box.className = 'account';
  box.innerHTML =
    '<p class="account-who"></p>' +
    '<form class="account-in">' +
      '<input type="email" name="email" autocomplete="email" required placeholder="EMAIL">' +
      '<input type="password" name="password" autocomplete="current-password" required ' +
             'minlength="8" placeholder="PASSWORD">' +
      '<div class="account-row">' +
        '<button type="submit" data-account="in">' + SAY.in + '</button>' +
        '<button type="button" data-account="join">' + SAY.join + '</button>' +
      '</div>' +
    '</form>' +
    '<div class="account-row account-mine">' +
      '<button type="button" data-account="out">' + SAY.out + '</button>' +
      '<button type="button" data-account="gone">' + SAY.gone + '</button>' +
    '</div>' +
    '<p class="account-say" role="status"></p>';
  menu.append(box);

  const form = box.querySelector('.account-in');
  const who = () => {
    const data = new FormData(form);
    return { email: String(data.get('email') || ''), password: String(data.get('password') || '') };
  };

  form.onsubmit = e => {
    e.preventDefault();
    tries(form.querySelector('[data-account=in]'), async () => {
      hold(await call('/auth/v1/token', { query: '?grant_type=password', body: who() }));
      if (await pull()) land();
      else await flush();   /* nothing up there yet: send what this browser has */
    });
  };

  box.querySelector('[data-account=join]').onclick = e => {
    if (!form.reportValidity()) return;
    tries(e.currentTarget, async () => {
      const made = await call('/auth/v1/signup', { body: who() });
      if (made?.access_token) {
        hold(made);
        /* a new account starts from whatever this browser already had */
        for (const key of CARRIED) push(key);
        await flush();
        says('ACCOUNT MADE.');
      } else {
        /* the project is set to confirm an address first */
        says('CHECK YOUR EMAIL TO CONFIRM, THEN SIGN IN.');
      }
    });
  };

  box.querySelector('[data-account=out]').onclick = async () => {
    const bearer = await token();
    clearTimeout(timer);
    pending = {};
    if (bearer) await call('/auth/v1/logout', { token: bearer }).catch(() => {});
    hold(null);
    try { sessionStorage.removeItem(PULLED); } catch { /* no store */ }
    says('SIGNED OUT. THIS DEVICE KEEPS THE TABLE IT HAS.');
  };

  /* Gone is gone, so it takes two presses: the first says what the second will do. */
  let armed;
  box.querySelector('[data-account=gone]').onclick = e => {
    const button = e.currentTarget;
    if (button.textContent !== SAY.sure) {
      button.textContent = SAY.sure;
      clearTimeout(armed);
      armed = setTimeout(() => { button.textContent = SAY.gone; }, 5000);
      return;
    }
    clearTimeout(armed);
    button.textContent = SAY.gone;
    tries(button, async () => {
      const bearer = await token();
      if (!bearer) return;
      await call('/rest/v1/rpc/delete_account', { body: {}, token: bearer });
      hold(null);
      says('ACCOUNT DELETED.');
    });
  };

  paint();
  if (session) pull().then(moved => { if (moved) land(); }).catch(() => {});
}
