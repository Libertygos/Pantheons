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
  activatePower,
  questionCap,
  sameTargetAllowed,
  isAskBlocked,
  questionsAgainst,
  seatOrderFromMeneur,
  hasEffectivePower,
  noOuiLastTurn,
  powerKeyOfCardId,
  type PiocheIntent,
  type QuestionIntent,
  type QuestionPlay,
  type AnswerResult,
  type ReponseResolution,
  type PrivateReveal,
  type PowerActivation,
  type PowerActivationResult,
} from './rules.js';
export {
  project,
  type PlayerProjection,
  type OpponentView,
  type SelfView,
  type BoardView,
  type PlacedCardView,
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
