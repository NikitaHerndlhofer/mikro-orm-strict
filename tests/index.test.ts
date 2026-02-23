import { vi, describe, it, expect, beforeEach } from 'vitest';

// vi.hoisted ensures these exist when the hoisted vi.mock factory runs
const { assignSpy, createSpy, getRefSpy, wrapMock } = vi.hoisted(() => ({
  assignSpy: vi.fn(),
  createSpy: vi.fn(),
  getRefSpy: vi.fn(),
  wrapMock: vi.fn(),
}));

vi.mock('@mikro-orm/core', async () => {
  const actual =
    await vi.importActual<typeof import('@mikro-orm/core')>('@mikro-orm/core');

  // Replace prototype methods BEFORE our source module captures references
  actual.EntityManager.prototype.assign = assignSpy as any;
  actual.EntityManager.prototype.create = createSpy as any;
  actual.EntityManager.prototype.getReference = getRefSpy as any;

  return { ...actual, wrap: wrapMock };
});

import { EntityManager } from '@mikro-orm/core';
import {
  assertFlushed,
  isFlushed,
  fieldsFor,
  UnflushedEntityError,
} from '../src/index';

function fakeMeta(
  className: string,
  props: {
    name: string;
    primary?: boolean;
    defaultRaw?: string;
    version?: boolean;
  }[],
) {
  return { __meta: { className, props } };
}

function setupWrap(
  className: string,
  props: {
    name: string;
    primary?: boolean;
    defaultRaw?: string;
    version?: boolean;
  }[],
) {
  wrapMock.mockReturnValue(fakeMeta(className, props));
}

// =============================================================================
// assertFlushed / isFlushed
// =============================================================================

describe('assertFlushed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not throw when all db-generated fields are defined', () => {
    const entity = { id: 'abc', createdAt: new Date(), version: 1 };
    setupWrap('User', [
      { name: 'id', primary: true, defaultRaw: 'gen_random_uuid()' },
      { name: 'createdAt', defaultRaw: 'NOW()' },
      { name: 'version', version: true },
    ]);

    expect(() => assertFlushed(entity)).not.toThrow();
  });

  it('throws when primary key is undefined', () => {
    const entity = { id: undefined, email: 'a@b.com' };
    setupWrap('User', [
      { name: 'id', primary: true },
      { name: 'email' },
    ]);

    expect(() => assertFlushed(entity)).toThrow(UnflushedEntityError);
  });

  it('throws when defaultRaw field is undefined', () => {
    const entity = { id: '1', createdAt: undefined };
    setupWrap('Post', [
      { name: 'id', primary: true },
      { name: 'createdAt', defaultRaw: 'NOW()' },
    ]);

    expect(() => assertFlushed(entity)).toThrow(UnflushedEntityError);
  });

  it('throws when version field is undefined', () => {
    const entity = { id: '1', version: undefined };
    setupWrap('Item', [
      { name: 'id', primary: true },
      { name: 'version', version: true },
    ]);

    expect(() => assertFlushed(entity)).toThrow(UnflushedEntityError);
  });

  it('allows null values — only undefined triggers failure', () => {
    const entity = { id: '1', createdAt: null };
    setupWrap('User', [
      { name: 'id', primary: true },
      { name: 'createdAt', defaultRaw: 'NOW()' },
    ]);

    expect(() => assertFlushed(entity)).not.toThrow();
  });

  it('does not duplicate field names when primary AND defaultRaw overlap', () => {
    const entity = { id: undefined };
    setupWrap('User', [
      { name: 'id', primary: true, defaultRaw: 'gen_random_uuid()' },
    ]);

    try {
      assertFlushed(entity);
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as UnflushedEntityError;
      expect(err.undefinedFields).toEqual(['id']);
    }
  });

  it('does not duplicate field names when version AND defaultRaw overlap', () => {
    const entity = { version: undefined };
    setupWrap('Foo', [
      { name: 'version', version: true, defaultRaw: '1' },
    ]);

    try {
      assertFlushed(entity);
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as UnflushedEntityError;
      expect(err.undefinedFields).toEqual(['version']);
    }
  });

  it('does not duplicate when primary + defaultRaw + version all set on one field', () => {
    const entity = { id: undefined };
    setupWrap('Edge', [
      { name: 'id', primary: true, defaultRaw: '1', version: true },
    ]);

    try {
      assertFlushed(entity);
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as UnflushedEntityError;
      expect(err.undefinedFields).toEqual(['id']);
    }
  });

  it('includes entity name and field names in error', () => {
    const entity = { id: undefined, updatedAt: undefined, name: 'test' };
    setupWrap('Article', [
      { name: 'id', primary: true },
      { name: 'updatedAt', defaultRaw: 'NOW()' },
      { name: 'name' },
    ]);

    try {
      assertFlushed(entity);
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as UnflushedEntityError;
      expect(err.entityName).toBe('Article');
      expect(err.undefinedFields).toEqual(['id', 'updatedAt']);
      expect(err.message).toContain('Article');
      expect(err.message).toContain('id');
      expect(err.message).toContain('updatedAt');
    }
  });

  it('uses string context as error message', () => {
    const entity = { id: undefined };
    setupWrap('User', [{ name: 'id', primary: true }]);

    try {
      assertFlushed(entity, 'Custom error message');
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as UnflushedEntityError;
      expect(err.message).toBe('Custom error message');
      expect(err.context).toBe('Custom error message');
    }
  });

  it('stores object context and uses default message', () => {
    const entity = { id: undefined };
    const ctx = { operation: 'createUser', email: 'a@b.com' };
    setupWrap('User', [{ name: 'id', primary: true }]);

    try {
      assertFlushed(entity, ctx);
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as UnflushedEntityError;
      expect(err.message).toContain('User not flushed');
      expect(err.context).toBe(ctx);
    }
  });

  it('ignores non-generated fields that happen to be undefined', () => {
    const entity = { id: '1', email: undefined, name: undefined };
    setupWrap('User', [
      { name: 'id', primary: true },
      { name: 'email' },
      { name: 'name' },
    ]);

    expect(() => assertFlushed(entity)).not.toThrow();
  });
});

describe('isFlushed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when all db-generated fields are defined', () => {
    const entity = { id: '1', createdAt: new Date() };
    setupWrap('User', [
      { name: 'id', primary: true },
      { name: 'createdAt', defaultRaw: 'NOW()' },
    ]);

    expect(isFlushed(entity)).toBe(true);
  });

  it('returns false when any db-generated field is undefined', () => {
    const entity = { id: undefined };
    setupWrap('User', [
      { name: 'id', primary: true, defaultRaw: 'gen_random_uuid()' },
    ]);

    expect(isFlushed(entity)).toBe(false);
  });

  it('returns true for entity with zero db-generated fields', () => {
    const entity = { key: 'manual', value: 42 };
    setupWrap('Config', [{ name: 'key' }, { name: 'value' }]);

    expect(isFlushed(entity)).toBe(true);
  });
});

// =============================================================================
// fieldsFor
// =============================================================================

describe('fieldsFor', () => {
  it('returns the fields array as provided', () => {
    class FakeEntity {}
    const result = fieldsFor(FakeEntity as any, '*' as any, 'foo' as any);
    expect(result).toEqual(['*', 'foo']);
  });

  it('returns an empty array when no fields given', () => {
    class FakeEntity {}
    const result = fieldsFor(FakeEntity as any);
    expect(result).toEqual([]);
  });
});

// =============================================================================
// UnflushedEntityError
// =============================================================================

describe('UnflushedEntityError', () => {
  it('extends Error', () => {
    const err = new UnflushedEntityError('User', ['id']);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UnflushedEntityError);
  });

  it('has name "UnflushedEntityError"', () => {
    const err = new UnflushedEntityError('User', ['id']);
    expect(err.name).toBe('UnflushedEntityError');
  });

  it('includes entity and fields in default message', () => {
    const err = new UnflushedEntityError('Post', ['id', 'createdAt']);
    expect(err.message).toContain('Post');
    expect(err.message).toContain('id');
    expect(err.message).toContain('createdAt');
  });

  it('uses string context as message', () => {
    const err = new UnflushedEntityError('User', ['id'], 'boom');
    expect(err.message).toBe('boom');
  });

  it('uses default message when context is an object', () => {
    const ctx = { foo: 'bar' };
    const err = new UnflushedEntityError('User', ['id'], ctx);
    expect(err.message).toContain('User not flushed');
    expect(err.context).toBe(ctx);
  });

  it('has a stack trace', () => {
    const err = new UnflushedEntityError('User', ['id']);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('UnflushedEntityError');
  });
});

// =============================================================================
// Prototype augmentation — delegation to originals
// =============================================================================

describe('prototype augmentation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds assignStrict to EntityManager.prototype', () => {
    expect(typeof (EntityManager.prototype as any).assignStrict).toBe(
      'function',
    );
  });

  it('adds createStrict to EntityManager.prototype', () => {
    expect(typeof (EntityManager.prototype as any).createStrict).toBe(
      'function',
    );
  });

  it('adds getStrictReference to EntityManager.prototype', () => {
    expect(typeof (EntityManager.prototype as any).getStrictReference).toBe(
      'function',
    );
  });

  it('assignStrict delegates to the original assign with correct args', () => {
    assignSpy.mockReturnValue('assign-result');

    const fakeThis = {};
    const entity = { id: '1' };
    const data = { name: 'x' };
    const opts = { mergeObjectProperties: true };

    const fn = (EntityManager.prototype as any).assignStrict;
    const result = fn.call(fakeThis, entity, data, opts);

    expect(assignSpy).toHaveBeenCalledOnce();
    expect(assignSpy).toHaveBeenCalledWith(entity, data, opts);
    expect(result).toBe('assign-result');
  });

  it('createStrict delegates to the original create with correct args', () => {
    createSpy.mockReturnValue('create-result');

    const fakeThis = {};
    class MyEntity {}
    const data = { email: 'a@b.com' };
    const opts = { managed: true };

    const fn = (EntityManager.prototype as any).createStrict;
    const result = fn.call(fakeThis, MyEntity, data, opts);

    expect(createSpy).toHaveBeenCalledOnce();
    expect(createSpy).toHaveBeenCalledWith(MyEntity, data, opts);
    expect(result).toBe('create-result');
  });

  it('getStrictReference delegates to the original getReference with correct args', () => {
    getRefSpy.mockReturnValue('ref-result');

    const fakeThis = {};
    class MyEntity {}

    const fn = (EntityManager.prototype as any).getStrictReference;
    const result = fn.call(fakeThis, MyEntity, 'pk-123');

    expect(getRefSpy).toHaveBeenCalledOnce();
    expect(getRefSpy).toHaveBeenCalledWith(MyEntity, 'pk-123');
    expect(result).toBe('ref-result');
  });

  it('assignStrict forwards undefined options correctly', () => {
    assignSpy.mockReturnValue({});

    const fn = (EntityManager.prototype as any).assignStrict;
    fn.call({}, {}, {});

    expect(assignSpy).toHaveBeenCalledWith({}, {}, undefined);
  });

  it('createStrict forwards undefined options correctly', () => {
    createSpy.mockReturnValue({});

    const fn = (EntityManager.prototype as any).createStrict;
    fn.call({}, class {}, {});

    expect(createSpy).toHaveBeenCalledWith(expect.any(Function), {}, undefined);
  });
});
