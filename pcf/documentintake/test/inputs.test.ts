import { controlInputsSchema, readControlInputs } from '../documentintake/inputs';

describe('control input validation', () => {
  it('accepts an absolute https base url', () => {
    const result = readControlInputs({
      baseUrl: { raw: 'https://contoso.example/api/v1' },
      pageSize: { raw: 50 },
    });
    expect(result).toEqual({
      ok: true,
      value: { baseUrl: 'https://contoso.example/api/v1', pageSize: 50 },
    });
  });

  it('accepts a host-relative base url', () => {
    const result = readControlInputs({ baseUrl: { raw: '/api/v1' }, pageSize: { raw: 25 } });
    expect(result.ok).toBe(true);
  });

  it('trims whitespace a maker left in the property panel', () => {
    const result = readControlInputs({ baseUrl: { raw: '  /api/v1  ' }, pageSize: { raw: 25 } });
    expect(result.ok && result.value.baseUrl).toBe('/api/v1');
  });

  it('rejects a missing base url with an actionable message', () => {
    const result = readControlInputs({ baseUrl: { raw: null }, pageSize: { raw: 25 } });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('baseUrl');
  });

  it('rejects a base url that is neither absolute nor host-relative', () => {
    const result = readControlInputs({
      baseUrl: { raw: 'contoso.example' },
      pageSize: { raw: 25 },
    });
    expect(result.ok).toBe(false);
  });

  it('falls back to a sane page size instead of failing the whole control', () => {
    const result = readControlInputs({ baseUrl: { raw: '/api' }, pageSize: { raw: 9999 } });
    expect(result.ok && result.value.pageSize).toBe(25);
  });

  it('defaults the page size when the property is empty', () => {
    const result = readControlInputs({ baseUrl: { raw: '/api' }, pageSize: { raw: null } });
    expect(result.ok && result.value.pageSize).toBe(25);
  });

  it('infers its type from the schema rather than declaring one', () => {
    // If the schema and the type ever diverge this stops compiling.
    const parsed = controlInputsSchema.parse({ baseUrl: '/api', pageSize: 10 });
    expect(parsed.pageSize).toBe(10);
  });
});
