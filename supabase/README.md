# Accounts

An account carries three things between a browser and a phone: the table you left
mid-hand, the lesson you reached in the school, and how loud it is. Nothing else — there
is nothing else the game keeps.

You reach it the same way in both: open the menu, and **SETTINGS** is the fifth line
after MAHJONG GPT. Pressing it hands the menu over to the panel, and BACK gives it back.

An account is one account. Make it on the phone and it signs in on the web, and the
other way about — same project, same list of people, same email and password. The
password rule is the project's: neither client keeps a copy of it, because a copy is a
rule that can disagree.

Signed out, or before the project below exists, **none of this is in either app**: there
is no SETTINGS line at all, nothing is sent anywhere, and the saves sit in
`localStorage` and `UserDefaults` exactly as they did before. The two blank constants are
the switch.

## The one step that needs you

The Supabase connector here cannot create a project (it has no cost-confirmation tool),
so the project itself has to be made in the dashboard. It is free and takes a minute:

1. <https://supabase.com/dashboard> → **New project**, in the **Lineage Health Website**
   organization. Call it `mahjong-gpt`, region `us-west-1`, and let it generate the
   database password — nothing here ever uses it.
2. Tell me the project is up, or paste its URL and publishable (anon) key into the two
   pairs of constants below. Then the migration in `migrations/` gets applied.

It is a **separate project**, so it has its own Postgres, its own list of accounts, its
own keys and its own URL. It shares nothing with the Lineage Health project but the
organization it is billed under. (A separate *organization* would be cleaner still, but
Supabase allows only one free one per account, so that would cost money.)

## Where the two values go

| file | constants |
| --- | --- |
| `play/account.mjs` | `PROJECT`, `PUBLISHABLE` |
| `ios/MahjongGPT/Engine/Account.swift` | `project`, `publishable` |

`PROJECT` is `https://<ref>.supabase.co`, with no trailing slash. The publishable key
belongs in the page and in the app — that is what it is for. It carries no rights of its
own: every row is reached through a policy comparing `auth.uid()` to the row's owner, and
`anon` has no policy at all, so the key on its own reads nothing.

## What is in the database

One table and two functions, in `migrations/20261120000000_accounts.sql`:

- `public.saves` — one row per player: `user_id`, a `jsonb` `state`, `updated_at`. Row
  level security on, three policies, all of them "your row and nobody else's".
- `save_state(patch jsonb)` — merges the patch into the row with `||`. The apps save at
  different moments, so a plain upsert of the whole row would mean read-modify-write and
  a race between two devices.
- `delete_account()` — `security definer`, deletes the caller from `auth.users`; the save
  cascades. App Store guideline 5.1.1(v) requires it.

The value under each key is **the literal string the app would have put in local
storage**, so neither side reshapes anything.

| key | written by | read by |
| --- | --- | --- |
| `mahjong-school` | both | both |
| `mahjong-volume` | both | both |
| `mahjong-table-v1` | the web | the web |
| `mahjong-table-v1.ios` | the app | the app |

The table is the one value whose shape differs between the two, so it travels under a key
of its own: your half-played hand follows you from laptop to laptop, or phone to phone,
but not across. The school and the sound do cross. `node test-sync.mjs` is what holds the
two sides to those names.

## Two settings in the dashboard worth knowing about

Neither is reachable from the connector, so both are yours to decide:

- **Confirm email** is on by default, so a new account has to click a link before it can
  sign in. The apps already say so ("check your email to confirm, then sign in"). Turn it
  off under *Authentication ▸ Sign In / Providers ▸ Email* if you would rather not.
- **The built-in email sender allows 2 messages an hour** and is not meant for real use.
  If accounts are going to be used by anyone but you, set your own SMTP under
  *Authentication ▸ Emails*.

## What signing in does to a game already in progress

Signing in pulls the account's save down over what is on the device. That is the point —
it is how you get your game back — but it does mean a table played while signed out is
replaced rather than merged. Playing on signs the new state straight back up.
