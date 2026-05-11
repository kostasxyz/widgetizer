# Building the Contact widget in OSS Widgetizer

**You** (future Claude in the OSS repo) will build a Contact widget that, when
exported, produces the HTML markup and manifest the Widgetizer Hosted service
expects. This doc is the contract — everything you need without re-reading
the whole hosted spec.

Canonical references in `widgetizer-saas/widgetizer-hosted/docs/mvp-forms.md`:
§4 (manifest), §5 (field types), §6 (markup). When in doubt, defer to that
spec.

---

## What the OSS export must produce

Two artifacts, both inside the exported ZIP:

1. **HTML markup** for the form, embedded in whatever page hosts the widget
   (typically `index.html` for Arch).
2. **`widgetizer.forms.json`** at the ZIP root, describing every form on
   the site.

If either is missing or malformed, the hosted service ignores forms for
that site. There is no partial recognition — manifest must validate and
markup must match exactly.

---

## The minimal working example (one field)

### HTML markup

```html
<form
  data-widgetizer-form="contact"
  action="/__widgetizer/forms/contact"
  method="post"
>
  <label>
    Message
    <textarea name="message" required></textarea>
  </label>

  <!-- Honeypot — anti-bot. Must be invisible to humans. -->
  <input
    type="text"
    name="website"
    tabindex="-1"
    autocomplete="off"
    aria-hidden="true"
    style="position:absolute;left:-9999px;"
    data-widgetizer-honeypot
  />

  <!-- Turnstile placeholder — Worker enriches this at serve time. -->
  <div data-widgetizer-turnstile></div>

  <!-- Success/error text lands here. -->
  <p data-widgetizer-form-status aria-live="polite"></p>

  <button type="submit">Send</button>
</form>
```

### `widgetizer.forms.json` at ZIP root

```json
{
  "schema_version": 1,
  "generator": "widgetizer",
  "generator_version": "0.10.0",
  "forms": [
    {
      "key": "contact",
      "name": "Contact",
      "page_path": "/index.html",
      "fields": [
        {
          "key": "message",
          "label": "Message",
          "type": "textarea",
          "required": true,
          "max_length": 5000
        }
      ]
    }
  ]
}
```

That's the entire contract for a one-field form. Everything else below is
detail on what's variable and what isn't.

---

## What the Worker recognizes (the contract attributes)

The hosted Worker scans the served HTML for these attributes. Each one
triggers behaviour:

| Attribute | Where | What the Worker does with it |
|---|---|---|
| `data-widgetizer-form="<key>"` | on `<form>` | Detects the page has a form → injects `<script src="/__widgetizer/forms/client.js" defer></script>` before `</body>`. Value must match a form `key` in the manifest. |
| `action="/__widgetizer/forms/<key>"` | on `<form>` | The submission endpoint. Same `<key>` as the data attribute. The Worker derives the form_key from the URL path. |
| `name="<fieldKey>"` | on each input/textarea/select | Identifies the field. Must match a `key` in the manifest's `fields` array exactly. |
| `data-widgetizer-honeypot` + `name="website"` | on a hidden input | The Worker rejects submissions where `website` is non-empty. The field name `website` is hardcoded in the Worker — don't rename it. |
| `data-widgetizer-turnstile` | on a `<div>` (or any element) | Worker injects `class="cf-turnstile"` + `data-sitekey="<env key>"` here, and appends the Cloudflare Turnstile loader script before `</body>`. Existing classes on the element are preserved. |
| `data-widgetizer-form-status` | on any element | The client script renders the generic success/error message here. Use `aria-live="polite"` for accessibility. |

---

## What you do NOT include in the OSS export

The Worker does these automatically — including them in the export would
either duplicate or conflict:

- ❌ No `<script src="/__widgetizer/forms/client.js">` tag — the Worker
  injects it when it sees `data-widgetizer-form`.
- ❌ No `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js">` —
  Worker injects it when it sees `data-widgetizer-turnstile`.
- ❌ No `data-sitekey` value on the Turnstile div — Worker fills it in
  per environment. **The OSS export must never embed a hardcoded
  Turnstile site key.**
- ❌ No `class="cf-turnstile"` on the placeholder — Worker appends it
  (preserving any classes you add for layout/spacing, which IS allowed).

---

## Field rules

Supported types and their validation:

| `type` | Stored as | Validation |
|---|---|---|
| `text` | string | trimmed, `max_length` cap |
| `email` | string | trimmed, must match a basic email shape, `max_length` cap (default 320) |
| `tel` | string | trimmed, `max_length` cap |
| `url` | string | trimmed, must be a valid `http(s)://` URL, `max_length` cap |
| `textarea` | string | outer whitespace trimmed, `max_length` cap (default 5000) |
| `select` | string | must match one of the configured `options[].value` |
| `radio` | string | same as select |
| `checkbox` | boolean | `true` when checked. `required: true` checkboxes must be checked to submit. |

Caps that the hosted service enforces (defaults if `max_length` omitted):

- `textarea`: 5000 characters max
- `email`: 320 characters max
- everything else (`text`, `tel`, `url`, `select`/`radio` values): 500 characters max
- `select`/`radio` `options`: up to 50 per field, each value/label ≤ 200 chars

### Key charset

Form `key` and field `key` values must match `/^[a-z0-9_-]{1,64}$/`.
Reason: they end up in URLs (`POST /__widgetizer/forms/:formKey`). No
uppercase, no spaces, no dots.

### Max 5 forms per site

Hosted service caps the manifest at 5 forms. Widgetizer is for small
sites; if a user needs more, that's a separate conversation.

### Max 30 fields per form

Same rationale.

---

## Manifest details

```json
{
  "schema_version": 1,          // required, must equal 1
  "generator": "widgetizer",    // required, must equal "widgetizer"
  "generator_version": "0.10.0", // optional, free-form
  "forms": [                    // required, array (0–5 entries)
    {
      "key": "contact",          // required, /^[a-z0-9_-]{1,64}$/
      "name": "Contact",         // required, ≤ 200 chars (display label in dashboard)
      "widget": "arch/contact",  // optional, free-form identifier of which widget emitted this
      "page_path": "/index.html",// optional, must start with "/" if present
      "success_message": null,    // optional, ≤ 500 chars OR null (currently unused by hosted UI)
      "fields": [                // required, 1–30 entries (0 is also accepted = no forms detected)
        {
          "key": "message",       // required, /^[a-z0-9_-]{1,64}$/, unique within this form
          "label": "Message",     // required, 1–200 chars
          "type": "textarea",     // required, one of the 8 supported types
          "required": true,       // optional boolean (defaults to false)
          "max_length": 5000      // optional integer
          // for select/radio, add:
          // "options": [{"value": "a", "label": "Option A"}, ...]
        }
      ]
    }
  ]
}
```

### Multiple fields, multiple types

```json
{
  "key": "contact",
  "name": "Contact",
  "fields": [
    { "key": "name",    "label": "Name",    "type": "text",     "required": true,  "max_length": 200 },
    { "key": "email",   "label": "Email",   "type": "email",    "required": true,  "max_length": 320 },
    { "key": "topic",   "label": "Topic",   "type": "select",   "required": true,
      "options": [
        { "value": "support",  "label": "Support" },
        { "value": "sales",    "label": "Sales" },
        { "value": "other",    "label": "Other" }
      ]
    },
    { "key": "message", "label": "Message", "type": "textarea", "required": true,  "max_length": 5000 },
    { "key": "subscribe", "label": "Subscribe to newsletter", "type": "checkbox", "required": false }
  ]
}
```

The HTML for select/radio: each option is an `<option value="X">Y</option>`
inside a `<select name="topic">`. Hosted service matches the submitted
value against the manifest's `options[].value` set; mismatches are
rejected as invalid submissions.

---

## Honeypot details (don't skip this)

The honeypot is a hidden field humans never fill in but bots usually do.
The Worker hard-rejects any submission where the `website` field is
non-empty.

### Markup requirements

- `name="website"` — hardcoded, do not rename
- `data-widgetizer-honeypot` data attribute — used by the client script
  to ignore the field in some cases
- Hidden via CSS that doesn't break screen readers:
  - `tabindex="-1"` so keyboard users skip it
  - `autocomplete="off"` so password managers don't fill it
  - `aria-hidden="true"` so screen readers skip it
  - `style="position:absolute;left:-9999px;"` (or a class with similar
    rules) so it's not visible

### Don't list it in the manifest

The honeypot field must NOT appear in `widgetizer.forms.json`. The
Worker treats it as a "platform field" that's always allowed in the
request body but never stored or validated as a real field. Listing it
in the manifest would create a real field collision.

---

## Turnstile details

You're not configuring Turnstile in the OSS export — the hosted Worker
does it. Your job is to leave the placeholder in the right shape.

### Markup requirements

- An empty element (`<div>` is conventional) with `data-widgetizer-turnstile`
- No `class="cf-turnstile"` (Worker adds it)
- No `data-sitekey="..."` (Worker fills it)
- No Cloudflare Turnstile script tag (Worker injects it)

You CAN add layout/spacing classes to the placeholder div — the Worker
preserves them and appends `cf-turnstile` to the class list rather than
overwriting:

```html
<div data-widgetizer-turnstile class="mt-4 flex justify-center"></div>
```

Becomes at serve time:

```html
<div data-widgetizer-turnstile class="mt-4 flex justify-center cf-turnstile" data-sitekey="..."></div>
```

---

## Status display details

- One element per form, with `data-widgetizer-form-status`
- Empty by default — the client script writes text into it
- `aria-live="polite"` so screen readers announce success/error
- The text content is generic per spec §9: success message or "Please
  check the form and try again." The script ignores any text you put in
  this element initially.

---

## Where the manifest lives in the ZIP

Top-level. Side by side with `index.html`:

```
my-site.zip
├── index.html
├── widgetizer.forms.json   ← here
├── style.css
├── assets/
│   └── logo.svg
└── ...
```

NOT inside a subfolder. NOT renamed. The hosted service looks for
`./widgetizer.forms.json` literally.

---

## Round-trip testing

A known-good fixture lives in the hosted repo at
`server/tests/fixtures/widgetizer-form-site/`:

- `index.html` — minimal page with one form (name + email + message)
- `widgetizer.forms.json` — matching manifest

When testing the OSS-emitted output, compare against this fixture. The
hosted service's manifest parser unit tests
(`server/tests/unit/forms.manifest.test.js`) define every accept/reject
rule — if your manifest passes those tests, it'll pass at publish time.

### Easy verification loop

1. Build a site in OSS Widgetizer with a Contact widget.
2. Export to ZIP.
3. Unzip it and inspect:
   - Does `widgetizer.forms.json` exist at the root?
   - Does it parse as valid JSON?
   - Does the form HTML carry `data-widgetizer-form`, a honeypot, a
     Turnstile placeholder, and a status element?
4. Upload it to a Hobby-tier site on staging and publish.
5. The Forms section of the dashboard should list the form with 0
   submissions. If the dashboard shows "No forms detected" instead,
   something in the manifest didn't validate — check the server logs
   for the `ValidationError` message, which names the failing
   `code` and `path`.

---

## What "future Claude in the OSS repo" actually does

When you start work in the OSS Widgetizer project:

1. **Find the existing widget patterns.** Look at how other widgets are
   structured, exported, and rendered. Match those conventions.
2. **Implement the Contact widget itself.** UI for placing it on a page,
   configuring fields (or just hardcoding name+email+message for v1),
   rendering the markup with the data attributes above.
3. **Wire the manifest emitter into the export pipeline.** When the user
   exports their site, walk all Contact widgets on all pages, collect
   their fields, and write `widgetizer.forms.json` at the ZIP root. If
   the site has no Contact widgets, you can either omit the manifest
   entirely OR write one with `"forms": []` — the hosted service treats
   both the same.
4. **Verify the export against the contract.** Spot check: open the
   exported ZIP, confirm the manifest validates, confirm the HTML has
   the right attributes.

### v1 scope suggestion (smallest useful Contact widget)

- Three hardcoded fields: name (text), email (email), message (textarea).
- One form per page max.
- The widget's "settings" panel: just a button to add/remove the widget
  from the page. No per-field configuration in v1 — keep the export
  predictable.
- Form key: hardcode `"contact"` for v1. Multi-form support comes later.
- `generator_version` in the manifest: read from the OSS package.json.

That's enough for the hosted service to recognize the form, accept
submissions, and surface them in the dashboard. Field configuration UI
can come in a follow-up release.

---

## What's out of scope for the OSS widget

- File uploads (hosted service doesn't accept files yet)
- Multi-select
- Conditional fields
- Custom recipient addresses (hosted always emails the site owner)
- Custom success/error copy (hosted uses generic messages by design)
- Embedded analytics

If a user wants any of these, they're post-MVP on both sides.

---

## Reference: the four "do not break this" rules

1. **The hosted service never trusts the OSS export's manifest blindly.**
   It re-validates everything at publish time. So a malformed manifest =
   publish fails with a clear error. You can't accidentally break
   the hosted service from the OSS side.

2. **The honeypot field name `website` is part of the contract.** The
   Worker hardcodes it. If you rename it, hosted will silently never
   reject bot submissions.

3. **Never embed Turnstile keys or scripts in the OSS export.** Staging
   and production use different keys; the Worker injects the right one.
   Embedding a key would either leak it or break the widget in the
   wrong environment.

4. **Form `key` values are URL path components.** Lowercase alphanumeric
   plus `-` and `_`, max 64 chars. No spaces, no dots, no uppercase.
   The Worker URL-decodes the path but doesn't normalize, so case
   matters.
