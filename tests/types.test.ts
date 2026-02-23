/**
 * Type-level tests.
 *
 * These verify compile-time behavior only. The key trick: wrap runtime-
 * dependent calls inside functions that are never invoked. TypeScript still
 * type-checks the body, proving the narrowing works, but vitest never
 * executes the MikroORM runtime path.
 */
import { describe, it, expectTypeOf } from 'vitest';
import type { Unflushed, PartialEntity } from '../src/index';
import { assertFlushed, isFlushed } from '../src/index';

// Fake entity (no decorators needed for pure type tests)
interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
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
