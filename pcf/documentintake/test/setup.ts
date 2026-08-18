/**
 * React 18 only enables `act()` support when this flag is set; without it every
 * `act` call logs "The current testing environment is not configured to support
 * act(...)" and state updates are not flushed deterministically.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
