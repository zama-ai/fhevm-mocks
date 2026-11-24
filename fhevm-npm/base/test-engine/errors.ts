/**
 * A failure that the engine detects and explains: an invalid inventory, an unknown test ID, a bad
 * option. The command prints its message and fails the run. Any other thrown value is a defect of the
 * engine, and is not caught as one of these.
 */
export class TestEngineError extends Error {
  override readonly name = 'TestEngineError';
}
