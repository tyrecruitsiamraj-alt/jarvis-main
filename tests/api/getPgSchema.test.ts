import { describe, it, expect, afterEach } from 'vitest';
import { getPgSchema } from '../../api/_lib/env.js';

describe('getPgSchema', () => {
  const prevPg = process.env.PGSCHEMA;
  const prevDb = process.env.DATABASE_SCHEMA;

  afterEach(() => {
    if (prevPg === undefined) delete process.env.PGSCHEMA;
    else process.env.PGSCHEMA = prevPg;
    if (prevDb === undefined) delete process.env.DATABASE_SCHEMA;
    else process.env.DATABASE_SCHEMA = prevDb;
  });

  it('accepts plain schema name', () => {
    process.env.PGSCHEMA = 'jarvis_rm';
    delete process.env.DATABASE_SCHEMA;
    expect(getPgSchema()).toBe('jarvis_rm');
  });

  it('strips surrounding quotes from env value', () => {
    process.env.PGSCHEMA = '"jarvis_rm"';
    delete process.env.DATABASE_SCHEMA;
    expect(getPgSchema()).toBe('jarvis_rm');

    process.env.PGSCHEMA = "'jarvis_rm'";
    expect(getPgSchema()).toBe('jarvis_rm');
  });

  it('rejects invalid identifiers', () => {
    process.env.PGSCHEMA = 'jarvis-rm';
    delete process.env.DATABASE_SCHEMA;
    expect(getPgSchema()).toBeNull();
  });
});
