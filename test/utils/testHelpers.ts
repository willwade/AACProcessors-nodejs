// Test helper utilities for setup, teardown, and common operations
import fs from "fs";
import path from "path";
import os from "os";
import { performance } from "perf_hooks";

export interface TestEnvironment {
  tempDir: string;
  cleanup: () => void;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  memoryDelta: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

/**
 * Test environment manager for consistent setup and cleanup
 */
export class TestEnvironmentManager {
  private static environments: TestEnvironment[] = [];

  static createTempEnvironment(testName: string): TestEnvironment {
    const tempDir = path.join(
      os.tmpdir(),
      "aac-processors-test",
      testName,
      Date.now().toString(),
    );

    // Ensure directory exists
    fs.mkdirSync(tempDir, { recursive: true });

    const cleanup = () => {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
      }
    };

    const environment: TestEnvironment = { tempDir, cleanup };
    this.environments.push(environment);

    return environment;
  }

  static cleanupAll(): void {
    this.environments.forEach((env) => {
      try {
        env.cleanup();
      } catch (error) {
        console.warn("Failed to cleanup environment:", error);
      }
    });
    this.environments.length = 0;
  }

  static createTestFile(
    tempDir: string,
    filename: string,
    content: string | Buffer,
  ): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  static createTestFiles(
    tempDir: string,
    files: Record<string, string | Buffer>,
  ): Record<string, string> {
    const filePaths: Record<string, string> = {};

    Object.entries(files).forEach(([filename, content]) => {
      filePaths[filename] = this.createTestFile(tempDir, filename, content);
    });

    return filePaths;
  }
}

/**
 * Performance measurement utilities
 */
export class PerformanceHelper {
  static async measureAsync<T>(
    operation: () => Promise<T>,
    description?: string,
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();

    const result = await operation();

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();

    const metrics: PerformanceMetrics = {
      executionTime: endTime - startTime,
      memoryBefore,
      memoryAfter,
      memoryDelta: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        external: memoryAfter.external - memoryBefore.external,
      },
    };

    if (description) {
      console.log(`Performance [${description}]:`, {
        time: `${metrics.executionTime.toFixed(2)}ms`,
        memory: `+${Math.round(metrics.memoryDelta.heapUsed / 1024 / 1024)}MB`,
      });
    }

    return { result, metrics };
  }

  static measure<T>(
    operation: () => T,
    description?: string,
  ): { result: T; metrics: PerformanceMetrics } {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();

    const result = operation();

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();

    const metrics: PerformanceMetrics = {
      executionTime: endTime - startTime,
      memoryBefore,
      memoryAfter,
      memoryDelta: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        external: memoryAfter.external - memoryBefore.external,
      },
    };

    if (description) {
      console.log(`Performance [${description}]:`, {
        time: `${metrics.executionTime.toFixed(2)}ms`,
        memory: `+${Math.round(metrics.memoryDelta.heapUsed / 1024 / 1024)}MB`,
      });
    }

    return { result, metrics };
  }

  static expectPerformance(
    metrics: PerformanceMetrics,
    expectations: {
      maxTime?: number;
      maxMemoryMB?: number;
    },
  ): void {
    if (expectations.maxTime !== undefined) {
      expect(metrics.executionTime).toBeLessThan(expectations.maxTime);
    }

    if (expectations.maxMemoryMB !== undefined) {
      const memoryUsedMB = metrics.memoryDelta.heapUsed / 1024 / 1024;
      expect(memoryUsedMB).toBeLessThan(expectations.maxMemoryMB);
    }
  }
}

/**
 * File system test utilities
 */
export class FileSystemHelper {
  static createLargeFile(filePath: string, sizeInMB: number): void {
    const chunkSize = 1024 * 1024; // 1MB chunks
    const chunk = Buffer.alloc(chunkSize, "A");

    const writeStream = fs.createWriteStream(filePath);

    for (let i = 0; i < sizeInMB; i++) {
      writeStream.write(chunk);
    }

    writeStream.end();
  }

  static createCorruptedFile(filePath: string, originalContent: string): void {
    // Create a file with corrupted content (truncated, invalid characters, etc.)
    const corruptedContent =
      originalContent.slice(0, originalContent.length / 2) + "\0\xFF\xFE";
    fs.writeFileSync(filePath, corruptedContent, "binary");
  }

  static createEmptyFile(filePath: string): void {
    fs.writeFileSync(filePath, "");
  }

  static createBinaryFile(filePath: string, size: number = 1024): void {
    const buffer = Buffer.alloc(size);
    for (let i = 0; i < size; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    fs.writeFileSync(filePath, buffer);
  }

  static getFileStats(filePath: string): fs.Stats | null {
    try {
      return fs.statSync(filePath);
    } catch (error) {
      return null;
    }
  }

  static compareFiles(filePath1: string, filePath2: string): boolean {
    try {
      const content1 = fs.readFileSync(filePath1);
      const content2 = fs.readFileSync(filePath2);
      return content1.equals(content2);
    } catch (error) {
      return false;
    }
  }
}

/**
 * Async test utilities
 */
export class AsyncTestHelper {
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 5000,
    intervalMs: number = 100,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = await condition();
      if (result) {
        return;
      }
      await this.sleep(intervalMs);
    }

    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage?: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  static async runConcurrently<T>(
    operations: (() => Promise<T>)[],
    maxConcurrency: number = 5,
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const operation of operations) {
      const promise = operation().then((result) => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
        // Remove completed promises
        for (let i = executing.length - 1; i >= 0; i--) {
          if (
            await Promise.race([
              executing[i].then(() => true),
              Promise.resolve(false),
            ])
          ) {
            executing.splice(i, 1);
          }
        }
      }
    }

    await Promise.all(executing);
    return results;
  }
}

/**
 * Error testing utilities
 */
export class ErrorTestHelper {
  static expectError<T>(
    operation: () => T,
    expectedErrorType?: new (...args: any[]) => Error,
    expectedMessage?: string | RegExp,
  ): Error {
    let thrownError: Error | null = null;

    try {
      operation();
      fail("Expected operation to throw an error, but it did not");
    } catch (error) {
      thrownError = error as Error;
    }

    if (expectedErrorType) {
      expect(thrownError).toBeInstanceOf(expectedErrorType);
    }

    if (expectedMessage) {
      if (typeof expectedMessage === "string") {
        expect(thrownError!.message).toContain(expectedMessage);
      } else {
        expect(thrownError!.message).toMatch(expectedMessage);
      }
    }

    return thrownError!;
  }

  static async expectAsyncError<T>(
    operation: () => Promise<T>,
    expectedErrorType?: new (...args: any[]) => Error,
    expectedMessage?: string | RegExp,
  ): Promise<Error> {
    let thrownError: Error | null = null;

    try {
      await operation();
      fail("Expected async operation to throw an error, but it did not");
    } catch (error) {
      thrownError = error as Error;
    }

    if (expectedErrorType) {
      expect(thrownError).toBeInstanceOf(expectedErrorType);
    }

    if (expectedMessage) {
      if (typeof expectedMessage === "string") {
        expect(thrownError!.message).toContain(expectedMessage);
      } else {
        expect(thrownError!.message).toMatch(expectedMessage);
      }
    }

    return thrownError!;
  }
}

/**
 * Global test setup and teardown
 */
export function setupGlobalTestEnvironment(): void {
  // Global setup
  beforeAll(() => {
    // Increase timeout for performance tests
    jest.setTimeout(30000);
  });

  // Global teardown
  afterAll(() => {
    TestEnvironmentManager.cleanupAll();
  });
}

/**
 * Common test patterns
 */
export class TestPatterns {
  static testRoundTrip<T>(
    createData: () => T,
    serialize: (data: T) => string | Buffer,
    deserialize: (serialized: string | Buffer) => T,
    compare: (original: T, deserialized: T) => boolean,
  ): void {
    const original = createData();
    const serialized = serialize(original);
    const deserialized = deserialize(serialized);

    expect(compare(original, deserialized)).toBe(true);
  }

  static async testConcurrentAccess<T>(
    operation: () => Promise<T>,
    concurrency: number = 5,
    iterations: number = 10,
  ): Promise<T[]> {
    const operations = Array(iterations)
      .fill(0)
      .map(() => operation);
    return AsyncTestHelper.runConcurrently(operations, concurrency);
  }

  static testMemoryUsage<T>(
    operation: () => T,
    maxMemoryMB: number = 50,
  ): { result: T; metrics: PerformanceMetrics } {
    const { result, metrics } = PerformanceHelper.measure(operation);

    PerformanceHelper.expectPerformance(metrics, {
      maxMemoryMB,
    });

    return { result, metrics };
  }
}
