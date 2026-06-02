import { describe, it, expect } from 'vitest';
import { stripLanguageTag, cn } from '@/lib/utils';

describe('Utility Functions', () => {
  describe('stripLanguageTag', () => {
    it('should remove language tag from SKOS terms', () => {
      expect(stripLanguageTag('concept@en')).toBe('concept');
      expect(stripLanguageTag('term@sl')).toBe('term');
    });

    it('should handle multi-part language tags', () => {
      expect(stripLanguageTag('test-value@en-US')).toBe('test-value');
      expect(stripLanguageTag('værn@nb-NO')).toBe('værn');
    });

    it('should return value unchanged if no language tag present', () => {
      expect(stripLanguageTag('concept')).toBe('concept');
      expect(stripLanguageTag('simple-term')).toBe('simple-term');
    });

    it('should handle null and undefined values', () => {
      expect(stripLanguageTag(null)).toBe('');
      expect(stripLanguageTag(undefined)).toBe('');
    });

    it('should handle empty strings', () => {
      expect(stripLanguageTag('')).toBe('');
    });

    it('should preserve @ symbol in the middle of terms', () => {
      expect(stripLanguageTag('email@domain.com')).toBe('email@domain.com');
    });
  });

  describe('cn (merge classnames)', () => {
    it('should merge single class names', () => {
      expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base', isActive && 'active');
      expect(result).toContain('base');
      expect(result).toContain('active');
    });

    it('should handle false and undefined values', () => {
      const isFalse = false;
      const result = cn('base', isFalse && 'hidden', undefined, 'visible');
      expect(result).toContain('base');
      expect(result).toContain('visible');
      expect(result).not.toContain('hidden');
    });

    it('should resolve Tailwind conflicts correctly', () => {
      // When conflicting Tailwind classes are provided, tailwind-merge should resolve them
      const result = cn('px-2 px-4');
      expect(result).toContain('px-4');
    });

    it('should handle arrays and objects', () => {
      const result = cn(['px-2', 'py-1'], { 'text-bold': true, 'text-light': false });
      expect(result).toContain('px-2');
      expect(result).toContain('py-1');
      expect(result).toContain('text-bold');
      expect(result).not.toContain('text-light');
    });
  });
});


