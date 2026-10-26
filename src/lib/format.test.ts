import { describe, expect, it } from 'vitest';
import { defaultSessionTitle } from './format';
import { toConfig } from './data/convert';

describe('defaultSessionTitle', () => {
  it('puts the date after the group name', () => {
    expect(defaultSessionTitle('2026-10-26', 'Badminton')).toMatch(/^Badminton · Mon, Oct 26/);
  });
  it('treats the old "Badminton Tournament" default as unset', () => {
    expect(toConfig({ groupName: 'Badminton Tournament' }).groupName).toBe('Badminton');
    expect(toConfig({ groupName: 'Shuttle Club' }).groupName).toBe('Shuttle Club');
  });
});
