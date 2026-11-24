/** The exit status of a command that did its work and found no failed test. */
export const SUCCESS_EXIT_STATUS = 0;

/** The exit status of a run with at least one failed test, and of a report check that found a problem. */
export const FAILURE_EXIT_STATUS = 1;

/**
 * The exit status of a run that itself failed, as on an invalid inventory, a failed build, or a strict
 * run that does not start. It differs from the status of a failed test, so that a caller can tell a run
 * that could not judge its tests from a run that judged one failed.
 */
export const RUN_FAILURE_EXIT_STATUS = 2;
