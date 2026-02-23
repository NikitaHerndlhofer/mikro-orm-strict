/**
 * Module augmentations for all official MikroORM driver packages.
 * These are purely type-level — they add the strict methods to each
 * driver's EntityManager interface so users get autocomplete and
 * type checking regardless of which driver they use.
 *
 * If a driver package is not installed, the augmentation is simply ignored.
 */
import type { StrictMethods } from './index';

declare module '@mikro-orm/postgresql' {
  interface EntityManager extends StrictMethods {}
}

declare module '@mikro-orm/mysql' {
  interface EntityManager extends StrictMethods {}
}

declare module '@mikro-orm/mariadb' {
  interface EntityManager extends StrictMethods {}
}

declare module '@mikro-orm/sqlite' {
  interface EntityManager extends StrictMethods {}
}

declare module '@mikro-orm/better-sqlite' {
  interface EntityManager extends StrictMethods {}
}

declare module '@mikro-orm/libsql' {
  interface EntityManager extends StrictMethods {}
}

declare module '@mikro-orm/mssql' {
  interface EntityManager extends StrictMethods {}
}

declare module '@mikro-orm/mongodb' {
  interface EntityManager extends StrictMethods {}
}
