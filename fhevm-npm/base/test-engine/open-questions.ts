/**
 * The questions that the specification of the test engine leaves open. Each question has one function
 * here. The function logs that the behavior is to be implemented, and does the least that lets the run
 * continue. No other file of the engine answers an open question.
 */
function logToBeImplemented(question: string): void {
  console.warn(`🚧 To be implemented: ${question}`);
}

/**
 * Open question 3, "To be defined": whether a test can have a time limit of its own. Until the question
 * is answered, one limit applies to every test of a run: the one the run was launched with. Returns that
 * limit in milliseconds, or undefined when the run has none.
 */
export function timeLimitOfATest(runLimitSeconds: number | undefined): number | undefined {
  logToBeImplemented('a time limit for each test. One limit applies to every test of the run for now.');

  return runLimitSeconds === undefined ? undefined : runLimitSeconds * 1000;
}

/**
 * Open question 4, "To be defined": how the measured durations relate to the `duration` field of the
 * inventory. Until the question is answered, the report holds the measured durations, and the engine
 * reads the field for one thing only: the weight of a test, when it builds the lanes.
 */
export function measuredDurationsAndTheDurationField(): void {
  logToBeImplemented(
    "how the measured durations relate to the inventory's 'duration' field. The engine reads the field to build the lanes only, for now.",
  );
}

/**
 * Open question 6, "To be defined": how the inventory records the resources that isolation needs,
 * other than ports. No field records one yet. Until the question is answered, the engine keeps apart
 * the tests that state a common fixed port, which share a lane, and no other tests.
 */
export function resourcesThatIsolationNeeds(): void {
  logToBeImplemented(
    'how the inventory records the resources that isolation needs, other than ports. The engine keeps apart the tests that share a port only, for now.',
  );
}

/**
 * Open question 8, "To be defined": what happens to a run that is interrupted, which state its tests
 * get, and what the report contains. Until the question is answered, the engine stops every running
 * command, lets each test end as failed, and writes the report as for any run.
 */
export function interruptedRun(): void {
  logToBeImplemented(
    'what happens to an interrupted run. The engine stops every command, and each stopped test is failed, for now.',
  );
}
