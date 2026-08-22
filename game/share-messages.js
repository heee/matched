// Playfully competitive social copy for every invitation/share surface.
// Each surface combines 10 context-rich setups with 8 compatible challenges,
// yielding 80 polished variants without maintaining hundreds of near-duplicates.

const lastTemplateByKind = new Map();

function combine(setups, challenges) {
  return setups.flatMap((setup) => challenges.map((challenge) => (context) =>
    `${setup(context)} ${challenge(context)}`
  ));
}

function pickTemplate(kind, templates, context, random = Math.random) {
  let index = Math.floor(random() * templates.length);
  const previous = lastTemplateByKind.get(kind);
  if (templates.length > 1 && index === previous) index = (index + 1) % templates.length;
  lastTemplateByKind.set(kind, index);
  return templates[index](context);
}

const NEW_BOARD_SETUPS = [
  ({ inviter, title }) => `${inviter} has claimed ${title}.`,
  ({ inviter, title }) => `${inviter} opened ${title} and took the first look.`,
  ({ inviter, title }) => `${inviter} is waiting at ${title}.`,
  ({ inviter, title }) => `${title} is open, and ${inviter} is already feeling confident.`,
  ({ inviter, title }) => `${inviter} saved you a seat at ${title}.`,
  ({ inviter, title }) => `${inviter} has issued a friendly challenge at ${title}.`,
  ({ inviter, title }) => `${inviter} picked ${title} for the next showdown.`,
  ({ inviter, title }) => `The tiles are set at ${title}, and ${inviter} is ready.`,
  ({ inviter, title }) => `${inviter} wants real competition at ${title}.`,
  ({ inviter, title }) => `A seat just opened beside ${inviter} at ${title}.`,
];

const NEW_BOARD_CHALLENGES = [
  () => `Think you can take more pairs?`,
  () => `Get in before the good tiles are gone.`,
  () => `Bring your sharp eyes.`,
  () => `Come make them regret the confidence.`,
  () => `Try not to waste the opportunity.`,
  () => `Your move.`,
  () => `Come steal a few pairs.`,
  () => `Let's see who owns the board.`,
];

const LIVE_BOARD_SETUPS = [
  ({ title, cleared, total }) => `${cleared} of ${total} tiles are already cleared on ${title}.`,
  ({ title, pct }) => `${title} is ${pct}% cleared.`,
  ({ title, left }) => `Only ${left} tiles remain on ${title}.`,
  ({ title, pct }) => `I'm ${pct}% through ${title} and not slowing down.`,
  ({ title }) => `I'm clearing ${title} right now.`,
  ({ title, left }) => `${title} is down to ${left} tiles.`,
  ({ title }) => `${title} is underway and the easy pairs are disappearing.`,
  ({ title, pct }) => `We're ${pct}% through ${title}.`,
  ({ title, left }) => `${title} has ${left} tiles left and no mercy promised.`,
  ({ title, cleared }) => `${cleared} tiles are down on ${title}.`,
];

const LIVE_BOARD_CHALLENGES = [
  () => `Come take the rest.`,
  () => `Get in before the good tiles are gone.`,
  () => `Think you can still make a difference?`,
  () => `Grab a pair before I do.`,
  () => `Your move.`,
  () => `Come steal a few pairs while you still can.`,
  () => `Plenty of time to catch up. Probably.`,
  () => `Tap in and prove you're faster.`,
];

const RESULT_SETUPS = [
  ({ title, elapsed }) => `I cleared ${title} in ${elapsed}.`,
  ({ title, elapsed }) => `${title} went down in ${elapsed}.`,
  ({ title, elapsed }) => `The time to beat on ${title} is ${elapsed}.`,
  ({ title, elapsed }) => `I made short work of ${title}: ${elapsed}.`,
  ({ title, elapsed }) => `${title} fell in ${elapsed}.`,
  ({ title, elapsed }) => `Done with ${title} in ${elapsed}.`,
  ({ title, elapsed }) => `My time on ${title}: ${elapsed}.`,
  ({ title, elapsed }) => `I put up ${elapsed} on ${title}.`,
  ({ title, pairs }) => `I took ${pairs} pairs on ${title}.`,
  ({ title, rank, playerCount }) => `I finished #${rank} of ${playerCount} on ${title}.`,
];

const RESULT_CHALLENGES = [
  () => `Your turn.`,
  () => `Think you can beat it?`,
  () => `You're welcome to try.`,
  () => `Beat that.`,
  () => `A rematch seems fair.`,
  () => `Surely you can do better?`,
  () => `No pressure—just evidence.`,
  () => `Come defend your reputation.`,
];

const NOTICE_SETUPS = [
  ({ fromUser, roomTitle }) => `${fromUser} has claimed ${roomTitle}.`,
  ({ fromUser, roomTitle }) => `${fromUser} wants competition at ${roomTitle}.`,
  ({ fromUser, roomTitle }) => `${fromUser} saved you a seat at ${roomTitle}.`,
  ({ fromUser, roomTitle }) => `${roomTitle} is open, and ${fromUser} is already feeling confident.`,
  ({ fromUser, roomTitle }) => `${fromUser} is waiting for you at ${roomTitle}.`,
  ({ fromUser, roomTitle }) => `${fromUser} picked ${roomTitle} for the next showdown.`,
  ({ fromUser, roomTitle }) => `The tiles are set for ${fromUser} at ${roomTitle}.`,
  ({ fromUser, roomTitle }) => `${fromUser} thinks they have ${roomTitle} handled.`,
  ({ fromUser, roomTitle }) => `A challenge from ${fromUser} just landed: ${roomTitle}.`,
  ({ fromUser, roomTitle }) => `${fromUser} opened a seat for you at ${roomTitle}.`,
];

const NOTICE_CHALLENGES = [
  () => `Think you can take more pairs?`,
  () => `You were the obvious competition.`,
  () => `Try not to waste the opportunity.`,
  () => `Come make them regret the confidence.`,
  () => `Go steal a few pairs.`,
  () => `Your move.`,
  () => `Bring your sharp eyes.`,
  () => `Let's see who owns the board.`,
];

const NEW_BOARD_MESSAGES = combine(NEW_BOARD_SETUPS, NEW_BOARD_CHALLENGES);
const LIVE_BOARD_MESSAGES = combine(LIVE_BOARD_SETUPS, LIVE_BOARD_CHALLENGES);
const RESULT_MESSAGES = combine(RESULT_SETUPS, RESULT_CHALLENGES);
const NOTICE_MESSAGES = combine(NOTICE_SETUPS, NOTICE_CHALLENGES);

export const SHARE_MESSAGE_VARIANT_COUNTS = Object.freeze({
  newBoard: NEW_BOARD_MESSAGES.length,
  liveBoard: LIVE_BOARD_MESSAGES.length,
  result: RESULT_MESSAGES.length,
  notice: NOTICE_MESSAGES.length,
});

export function newBoardShareMessage(context, random) {
  return pickTemplate("new", NEW_BOARD_MESSAGES, context, random);
}

export function liveBoardShareMessage(context, random) {
  return pickTemplate("live", LIVE_BOARD_MESSAGES, context, random);
}

export function resultShareMessage(context, random) {
  return pickTemplate("result", RESULT_MESSAGES, context, random);
}

export function inviteNoticeMessage(context, random) {
  return pickTemplate("notice", NOTICE_MESSAGES, context, random);
}
