/** @pantheons/engine — pure rules/state. No I/O (Decision 2). Public barrel. */
export * from './types.js';
export * from './rng.js';
export * as data from './data/index.js';
export { GODS, ALL_GODS, TRANSCRIBED } from './data/gods.js';
export {
  RuleError,
  evaluateQuestion,
  applyPioche,
  applyQuestions,
  placeSpeciale,
  resolveReponsePhase,
  fireSpecialesAtPhaseStart,
  advanceTurn,
  applyPowerEffect,
  seatOrderFromMeneur,
  type PiocheIntent,
  type QuestionIntent,
  type QuestionPlay,
  type AnswerResult,
} from './rules.js';
export {
  project,
  type PlayerProjection,
  type OpponentView,
  type SelfView,
} from './projection.js';
export {
  resolveDeclarations,
  type DeclarationOutcome,
  type ResolveResult,
} from './declaration.js';
export {
  createGame,
  buildAttributDeck,
  buildActionDeck,
  buildPouvoirDeck,
  type SeatInput,
  type SetupResult,
  type CardIndex,
} from './setup.js';
