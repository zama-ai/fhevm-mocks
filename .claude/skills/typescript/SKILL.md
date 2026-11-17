---
name: typescript
description: House rules for TypeScript in this repository - undefined over null, object arguments, shared helpers for repeated checks, function length, and blank lines between steps. Use when writing, changing, or reviewing any TypeScript file.
---

# TypeScript

Apply these rules to every TypeScript line you write or change. When you touch code that breaks a rule, fix the code you touch. Do not rewrite a whole file for a rule unless the user asks.

ESLint, `tsc`, and Prettier still apply. These rules come on top of them.

## 1. Use `undefined`, not `null`

An absent value is `undefined`. Use `null` only where an outside format requires it, such as JSON or a library's type.

The best form is an optional property that also accepts `undefined`:

```ts
type RunOptions = {
  confirmations?: number | undefined;
};
```

A function that may find nothing returns `T | undefined`, not `T | null`.

## 2. Pass one typed object when a function takes more than one argument

A function with two or more arguments takes one object whose type names each field. A function with a single argument takes it directly.

```ts
// Not this: which string is the account, and which the address?
function signerFor(role: Role, chainId: bigint, account: string | undefined, admin: string | undefined): Signer;

// This:
type SignerInput = {
  role: Role;
  chainId: bigint;
  account?: string | undefined;
  admin?: string | undefined;
};
function signerFor(input: SignerInput): Signer;
```

## 3. Move a repeated one-line check into a shared helper

When the same check appears more than once, such as "is this value a JSON object", write it once as a helper and call the helper.

```ts
// Not this, copied into every reader:
if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) fail(`Error: ${path} is not a JSON object.`);

// This, in utils.ts:
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

## 4. Make a shared helper of any low-level operation that repeats

When a low-level test, algorithm, or operation occurs more than once, and it would make sense in any project, make it a shared helper. Comparing two addresses, reading a JSON file, and parsing a hex number are examples. A step that belongs to one feature stays in that feature's file.

## 5. Put shared helpers where a reader looks for them

Put a shared helper in `utils.ts`. When a group of helpers shares a topic, give the topic its own file, such as `string.ts`, `fs.ts`, or `json.ts`, beside `utils.ts`.

Before you write a helper, search for one that already exists. Reuse it rather than write a second one.

## 6. Split a function longer than 200 lines

Split a function longer than 200 lines into functions that each do one logical step. Name each function by its step. Keep a long function only when no split gives steps that make sense alone, and say why in a comment above it.

## 7. Separate the steps of a block with blank lines

A block of dense lines with no blank line is not accepted. Put a blank line between the steps of a block: between reading a value and checking it, and between one check and the next. Combined with rules 3 and 4, a dense block often shrinks into a few helper calls.

Not this:

```ts
const path = CHAINS_CONFIG_PATH;
if (!existsSync(path)) fail(`Error: no chain allow-list at ${path}.`);
let raw: unknown;
try {
  raw = readJson<unknown>(path);
} catch {
  fail(`Error: ${path} is not valid JSON.`);
}
if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) fail(`Error: ${path} is not a JSON object.`);
const obj = raw as Record<string, unknown>;
for (const key of Object.keys(obj)) {
  if (key !== '//' && key !== 'allowedChains') fail(`Error: unknown key '${key}' in ${path}.`);
}
if (!Array.isArray(obj.allowedChains) || obj.allowedChains.length === 0) {
  fail(`Error: ${path} needs a non-empty "allowedChains" array.`);
}
```

This, with `readJsonObjectOrFail` and `rejectUnknownKeys` as shared helpers in `json.ts`:

```ts
const path = CHAINS_CONFIG_PATH;
const obj = readJsonObjectOrFail(path);

rejectUnknownKeys({ obj, allowed: ['//', 'allowedChains'], path });

if (!Array.isArray(obj.allowedChains) || obj.allowedChains.length === 0) {
  fail(`Error: ${path} needs a non-empty "allowedChains" array.`);
}
```

## 8. Surround separator lines with blank lines

A separator is one line of `/` characters, at most 80 characters long. Put one blank line above it and one below it:

```ts
}

////////////////////////////////////////////////////////////////////////////////

export function preflight(ctx: Ctx): void {
```

A section title is a `// <Title>` line between two separator lines. Put one blank line above the block and one below it, and none inside it:

```ts
}

////////////////////////////////////////////////////////////////////////////////
// Journal
////////////////////////////////////////////////////////////////////////////////

export function recordJournal(ctx: Ctx): void {
```
