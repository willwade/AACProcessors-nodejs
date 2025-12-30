// Unit tests for StringCasing utilities
import {
  StringCasing,
  detectCasing,
  convertCasing,
  isNumericOrEmpty,
} from '../src/core/stringCasing';

describe('StringCasing', () => {
  describe('detectCasing', () => {
    it('should detect lowercase', () => {
      expect(detectCasing('hello world')).toBe(StringCasing.LOWER);
      expect(detectCasing('test')).toBe(StringCasing.LOWER);
    });

    it('should detect uppercase', () => {
      expect(detectCasing('HELLO WORLD')).toBe(StringCasing.UPPER);
      expect(detectCasing('TEST')).toBe(StringCasing.UPPER);
    });

    it('should detect sentence case', () => {
      expect(detectCasing('Hello world')).toBe(StringCasing.SENTENCE);
      expect(detectCasing('Test sentence')).toBe(StringCasing.SENTENCE);
    });

    it('should detect title case', () => {
      expect(detectCasing('Hello World')).toBe(StringCasing.TITLE);
      expect(detectCasing('Test Title Case')).toBe(StringCasing.TITLE);
    });

    it('should detect camelCase', () => {
      expect(detectCasing('helloWorld')).toBe(StringCasing.CAMEL);
      expect(detectCasing('testCamelCase')).toBe(StringCasing.CAMEL);
    });

    it('should detect PascalCase', () => {
      expect(detectCasing('HelloWorld')).toBe(StringCasing.PASCAL);
      expect(detectCasing('TestPascalCase')).toBe(StringCasing.PASCAL);
    });

    it('should detect snake_case', () => {
      expect(detectCasing('hello_world')).toBe(StringCasing.SNAKE);
      expect(detectCasing('test_snake_case')).toBe(StringCasing.SNAKE);
    });

    it('should detect CONSTANT_CASE', () => {
      expect(detectCasing('HELLO_WORLD')).toBe(StringCasing.CONSTANT);
      expect(detectCasing('TEST_CONSTANT_CASE')).toBe(StringCasing.CONSTANT);
    });

    it('should detect kebab-case', () => {
      expect(detectCasing('hello-world')).toBe(StringCasing.KEBAB);
      expect(detectCasing('test-kebab-case')).toBe(StringCasing.KEBAB);
    });

    it('should detect Header-Case', () => {
      expect(detectCasing('Hello-World')).toBe(StringCasing.HEADER);
      expect(detectCasing('Test-Header-Case')).toBe(StringCasing.HEADER);
    });

    it('should handle edge cases', () => {
      expect(detectCasing('')).toBe(StringCasing.LOWER);
      expect(detectCasing('   ')).toBe(StringCasing.LOWER);
      expect(detectCasing('A')).toBe(StringCasing.CAPITAL);
      expect(detectCasing('a')).toBe(StringCasing.LOWER);
    });
  });

  describe('convertCasing', () => {
    const testText = 'Hello World Test';

    it('should convert to lowercase', () => {
      expect(convertCasing(testText, StringCasing.LOWER)).toBe('hello world test');
    });

    it('should convert to uppercase', () => {
      expect(convertCasing(testText, StringCasing.UPPER)).toBe('HELLO WORLD TEST');
    });

    it('should convert to sentence case', () => {
      expect(convertCasing(testText, StringCasing.SENTENCE)).toBe('Hello world test');
    });

    it('should convert to title case', () => {
      expect(convertCasing(testText, StringCasing.TITLE)).toBe('Hello World Test');
    });

    it('should convert to camelCase', () => {
      expect(convertCasing(testText, StringCasing.CAMEL)).toBe('helloWorldTest');
    });

    it('should convert to PascalCase', () => {
      expect(convertCasing(testText, StringCasing.PASCAL)).toBe('HelloWorldTest');
    });

    it('should convert to snake_case', () => {
      expect(convertCasing(testText, StringCasing.SNAKE)).toBe('hello_world_test');
    });

    it('should convert to CONSTANT_CASE', () => {
      expect(convertCasing(testText, StringCasing.CONSTANT)).toBe('HELLO_WORLD_TEST');
    });

    it('should convert to kebab-case', () => {
      expect(convertCasing(testText, StringCasing.KEBAB)).toBe('hello-world-test');
    });

    it('should convert to Header-Case', () => {
      expect(convertCasing(testText, StringCasing.HEADER)).toBe('Hello-World-Test');
    });

    it('should handle empty strings', () => {
      expect(convertCasing('', StringCasing.UPPER)).toBe('');
      expect(convertCasing('   ', StringCasing.LOWER)).toBe('   ');
    });
  });

  describe('isNumericOrEmpty', () => {
    it('should identify numeric strings', () => {
      expect(isNumericOrEmpty('123')).toBe(true);
      expect(isNumericOrEmpty('0')).toBe(true);
      expect(isNumericOrEmpty('-5')).toBe(true);
    });

    it('should identify empty or short strings', () => {
      expect(isNumericOrEmpty('')).toBe(true);
      expect(isNumericOrEmpty(' ')).toBe(true);
      expect(isNumericOrEmpty('a')).toBe(true);
    });

    it('should identify meaningful text', () => {
      expect(isNumericOrEmpty('hello')).toBe(false);
      expect(isNumericOrEmpty('test word')).toBe(false);
      expect(isNumericOrEmpty('abc')).toBe(false);
    });

    it('should handle mixed content', () => {
      expect(isNumericOrEmpty('123abc')).toBe(false);
      expect(isNumericOrEmpty('hello123')).toBe(false);
    });
  });
});
