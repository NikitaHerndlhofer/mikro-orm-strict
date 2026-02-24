/**
 * Type-level tests.
 *
 * These verify compile-time behavior only. The key trick: wrap runtime-
 * dependent calls inside functions that are never invoked. TypeScript still
 * type-checks the body, proving the narrowing works, but vitest never
 * executes the MikroORM runtime path.
 */
import { describe, it, expectTypeOf } from 'vitest';
import type { Reference, Collection } from '@mikro-orm/core';
import type { Unflushed, PartialEntity, FieldsFor, DataKey } from '../src/index';
import { assertFlushed, isFlushed } from '../src/index';

// Fake entities (no decorators needed for pure type tests)
interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

interface Profile {
  id: string;
  avatar: string;
  bio: string | null;
}

interface Post {
  id: string;
  title: string;
}

interface UserWithRelations {
  id: string;
  email: string;
  profile: Reference<Profile>;
  posts: Collection<Post>;
}

// ---------------------------------------------------------------------------
// Unflushed<T>
// ---------------------------------------------------------------------------

describe('Unflushed<T>', () => {
  it('preserves the full key set', () => {
    type Result = Unflushed<User>;
    expectTypeOf<Result>().toHaveProperty('id');
    expectTypeOf<Result>().toHaveProperty('email');
    expectTypeOf<Result>().toHaveProperty('name');
    expectTypeOf<Result>().toHaveProperty('createdAt');
  });

  it('is assignable from the original entity', () => {
    expectTypeOf<User>().toMatchTypeOf<Unflushed<User>>();
  });
});

// ---------------------------------------------------------------------------
// PartialEntity<T>
// ---------------------------------------------------------------------------

describe('PartialEntity<T>', () => {
  it('preserves the full key set', () => {
    type Result = PartialEntity<User>;
    expectTypeOf<Result>().toHaveProperty('id');
    expectTypeOf<Result>().toHaveProperty('email');
    expectTypeOf<Result>().toHaveProperty('name');
    expectTypeOf<Result>().toHaveProperty('createdAt');
  });

  it('makes non-PK fields potentially undefined', () => {
    type Result = PartialEntity<User>;
    // Non-PK fields get `| undefined` added
    expectTypeOf<Result['email']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Result['createdAt']>().toEqualTypeOf<Date | undefined>();
  });

  it('is assignable from the original entity', () => {
    expectTypeOf<User>().toMatchTypeOf<PartialEntity<User>>();
  });
});

// ---------------------------------------------------------------------------
// assertFlushed narrows Unflushed<T> → T
// ---------------------------------------------------------------------------

describe('assertFlushed type narrowing', () => {
  it('narrows Unflushed<T> to T after assertion', () => {
    // Function is type-checked but never called (avoids runtime wrap() call)
    function _proof(user: Unflushed<User>) {
      assertFlushed(user);
      expectTypeOf(user).toEqualTypeOf<User>();
      expectTypeOf(user.id).toEqualTypeOf<string>();
    }
    expectTypeOf(_proof).toBeFunction();
  });

  it('accepts a plain T without error', () => {
    function _proof(user: User) {
      assertFlushed(user);
      expectTypeOf(user).toEqualTypeOf<User>();
    }
    expectTypeOf(_proof).toBeFunction();
  });
});

// ---------------------------------------------------------------------------
// isFlushed narrows in conditional branches
// ---------------------------------------------------------------------------

describe('isFlushed type narrowing', () => {
  it('narrows to T in the true branch', () => {
    function _proof(user: User | Unflushed<User>) {
      if (isFlushed(user)) {
        expectTypeOf(user).toEqualTypeOf<User>();
      }
    }
    expectTypeOf(_proof).toBeFunction();
  });
});

// ---------------------------------------------------------------------------
// DataKey<T>
// ---------------------------------------------------------------------------

describe('DataKey<T>', () => {
  it('extracts string property keys', () => {
    type Result = DataKey<User>;
    expectTypeOf<'id'>().toMatchTypeOf<Result>();
    expectTypeOf<'email'>().toMatchTypeOf<Result>();
    expectTypeOf<'name'>().toMatchTypeOf<Result>();
    expectTypeOf<'createdAt'>().toMatchTypeOf<Result>();
  });

  it('excludes methods', () => {
    interface WithMethod {
      id: string;
      doStuff(): void;
    }
    type Result = DataKey<WithMethod>;
    expectTypeOf<'id'>().toMatchTypeOf<Result>();
    expectTypeOf<'doStuff'>().not.toMatchTypeOf<Result>();
  });
});

// ---------------------------------------------------------------------------
// FieldsFor<T>
// ---------------------------------------------------------------------------

describe('FieldsFor<T>', () => {
  it('includes * for any entity', () => {
    expectTypeOf<'*'>().toMatchTypeOf<FieldsFor<User>>();
  });

  it('includes scalar keys for a flat entity', () => {
    type Result = FieldsFor<User>;
    expectTypeOf<'id'>().toMatchTypeOf<Result>();
    expectTypeOf<'email'>().toMatchTypeOf<Result>();
    expectTypeOf<'name'>().toMatchTypeOf<Result>();
    expectTypeOf<'createdAt'>().toMatchTypeOf<Result>();
  });

  it('rejects keys that do not exist', () => {
    type Result = FieldsFor<User>;
    expectTypeOf<'nonExistent'>().not.toMatchTypeOf<Result>();
  });

  it('includes relation keys as top-level fields', () => {
    type Result = FieldsFor<UserWithRelations>;
    expectTypeOf<'profile'>().toMatchTypeOf<Result>();
    expectTypeOf<'posts'>().toMatchTypeOf<Result>();
  });

  it('generates dotted paths for Reference relations', () => {
    type Result = FieldsFor<UserWithRelations>;
    expectTypeOf<'profile.id'>().toMatchTypeOf<Result>();
    expectTypeOf<'profile.avatar'>().toMatchTypeOf<Result>();
    expectTypeOf<'profile.bio'>().toMatchTypeOf<Result>();
    expectTypeOf<'profile.*'>().toMatchTypeOf<Result>();
  });

  it('generates dotted paths for Collection relations', () => {
    type Result = FieldsFor<UserWithRelations>;
    expectTypeOf<'posts.id'>().toMatchTypeOf<Result>();
    expectTypeOf<'posts.title'>().toMatchTypeOf<Result>();
    expectTypeOf<'posts.*'>().toMatchTypeOf<Result>();
  });

  it('rejects invalid nested paths', () => {
    type Result = FieldsFor<UserWithRelations>;
    expectTypeOf<'profile.nonExistent'>().not.toMatchTypeOf<Result>();
    expectTypeOf<'email.id'>().not.toMatchTypeOf<Result>();
  });

  it('does not generate paths for non-relation scalars', () => {
    type Result = FieldsFor<User>;
    expectTypeOf<'id.something'>().not.toMatchTypeOf<Result>();
  });

  it('respects depth limit', () => {
    interface Deep {
      id: string;
      child: Reference<UserWithRelations>;
    }

    type Depth1 = FieldsFor<Deep, [1]>;
    expectTypeOf<'child.id'>().toMatchTypeOf<Depth1>();
    expectTypeOf<'child.profile'>().toMatchTypeOf<Depth1>();
    // depth exhausted — no nested relation paths
    expectTypeOf<'child.profile.id'>().not.toMatchTypeOf<Depth1>();

    type Depth2 = FieldsFor<Deep, [1, 1]>;
    expectTypeOf<'child.profile.id'>().toMatchTypeOf<Depth2>();
    expectTypeOf<'child.profile.avatar'>().toMatchTypeOf<Depth2>();
  });
});
