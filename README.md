# mikro-orm-strict

Type-safe extensions for [MikroORM](https://mikro-orm.io/) that catch mistakes at compile time and make database-generated fields explicit in the type system.

## What it adds

| Method / Type | What it does |
|---|---|
| `em.createStrict()` | Like `em.create()` but returns `Unflushed<T>` and rejects unknown keys |
| `em.assignStrict()` | Like `em.assign()` but returns `PartialEntity<T>` and rejects unknown keys |
| `em.getStrictReference()` | Like `em.getReference()` but returns `PartialEntity<T>` |
| `Unflushed<T>` | Entity type where database-generated fields (`id`, `createdAt`, …) are `T \| undefined` |
| `PartialEntity<T>` | Entity type where only the primary key is guaranteed |
| `assertFlushed()` | Runtime assertion that narrows `Unflushed<T>` back to `T` |
| `isFlushed()` | Non-throwing type guard for the same |
| `FieldsFor<T>` | Union type of all valid field paths — use for annotations and parameters |
| `fieldsFor()` | Runtime helper that returns a type-safe `fields` array |
| `DataKey<T>` | String property keys of an entity, excluding methods |
| `ExtractRelations<T>` | Utility type that extracts relation keys from an entity |

## Install

```bash
npm install mikro-orm-strict
```

`@mikro-orm/core` >= 6 is a required peer dependency.

## Setup

Import the package **once** at the top of your application entry point (e.g. `main.ts`, `app.module.ts`, or your ORM config file). The import patches `EntityManager.prototype` and registers the new methods.

```ts
import 'mikro-orm-strict';
```

That's it. The type augmentations are applied automatically for `@mikro-orm/core` and all official driver packages (postgresql, mysql, sqlite, etc.).

## Usage

### `createStrict` — create entities with type-safe return

```ts
// Entity definition:
// @PrimaryKey({ defaultRaw: 'gen_random_uuid()' }) id!: string;
// @Property() email!: string;
// @Property({ defaultRaw: 'NOW()' }) createdAt: Date & Opt = new Date();

const user = em.createStrict(User, { email: 'john@example.com' });

user.id;        // string | undefined  — not generated yet
user.email;     // string              — you provided it
user.createdAt; // Date | undefined    — not generated yet

await em.flush();
assertFlushed(user);

user.id;        // string  — narrowed back to the full type
```

### `assignStrict` — update entities with key validation

```ts
const user = em.getStrictReference(User, userId);
em.assignStrict(user, { firstName: 'John', lastName: 'Doe' });

user.id;        // string              — PK is guaranteed
user.firstName; // string | undefined  — partial state

// Catches typos at compile time:
em.assignStrict(user, { firstNme: 'John' }); // ✗ compile error
```

### `getStrictReference` — update-without-select pattern

```ts
const user = em.getStrictReference(User, userId);
em.assignStrict(user, { deletedAt: new Date() });
await em.flush();
// Issues UPDATE without loading the entity first
```

### `assertFlushed` / `isFlushed` — narrow after flush

```ts
const user = em.createStrict(User, { email: 'a@b.com' });
await em.flush();

// Option 1: assertion (throws UnflushedEntityError if not flushed)
assertFlushed(user);
return user; // User, not Unflushed<User>

// Option 2: type guard
if (isFlushed(user)) {
  return user; // narrowed to User
}

// With error context:
assertFlushed(user, 'Failed to create user');
assertFlushed(user, { message: 'Failed to create user', email });
```

### `FieldsFor<T>` / `fieldsFor()` — type-safe partial loading

Use the `FieldsFor<T>` type for annotations, or the `fieldsFor()` function for inline construction:

```ts
import { FieldsFor, fieldsFor } from 'mikro-orm-strict';

// As a type annotation — useful for function signatures and shared constants
const fields: FieldsFor<User>[] = ['*', 'profile.avatar', 'posts.title'];

// Or via the helper function
const fields = fieldsFor(User, '*', 'profile.avatar', 'posts.title');

// Both work with MikroORM queries
const user = await em.findOneOrFail(User, id, { fields });
```

`FieldsFor<T>` recursively generates all valid dotted paths (up to 2 levels deep by default). Invalid paths like `'nonExistent'` or `'email.id'` are compile-time errors.

## Error handling

`assertFlushed` throws `UnflushedEntityError` (extends `Error`) with:
- `entityName` — the entity class name
- `undefinedFields` — array of field names that are still undefined
- `context` — the optional context you passed in

```ts
import { UnflushedEntityError } from 'mikro-orm-strict';

try {
  assertFlushed(entity);
} catch (e) {
  if (e instanceof UnflushedEntityError) {
    console.log(e.entityName, e.undefinedFields);
  }
}
```

## Compatibility

- MikroORM **>= 6.0.0**
- Works with all official drivers: PostgreSQL, MySQL, MariaDB, SQLite, better-sqlite, libSQL, MSSQL, MongoDB
- TypeScript **>= 5.0**

## License

MIT
