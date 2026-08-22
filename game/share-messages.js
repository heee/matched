// Playfully competitive social copy for every invitation/share surface.

const lastTemplateByKind = new Map();

function pickTemplate(kind, templates, context, random = Math.random) {
  let index = Math.floor(random() * templates.length);
  const previous = lastTemplateByKind.get(kind);
  if (templates.length > 1 && index === previous) index = (index + 1) % templates.length;
  lastTemplateByKind.set(kind, index);
  return templates[index](context);
}

const NEW_BOARD_MESSAGES = [
  ({ inviter, title }) => `${inviter} has claimed ${title}. Think you can take more pairs?`,
  ({ inviter, title }) => `${inviter} opened ${title}. Get in before the good tiles are gone.`,
  ({ inviter, title }) => `${inviter} is waiting at ${title}. Bring your sharp eyes.`,
  ({ inviter, title }) => `${title} is open, and ${inviter} is already feeling confident.`,
  ({ inviter, title }) => `${inviter} saved you a seat at ${title}. Try not to waste it.`,
  ({ inviter, title }) => `A friendly challenge from ${inviter}: take on ${title}.`,
  ({ inviter, title }) => `${inviter} picked ${title}. Your move.`,
  ({ inviter, title }) => `The tiles are set at ${title}. ${inviter} thinks they have this one.`,
  ({ inviter, title }) => `${inviter} wants competition at ${title}. You were the obvious choice.`,
  ({ inviter, title }) => `Seat open at ${title}. Come steal a few pairs from ${inviter}.`,
];

const LIVE_BOARD_MESSAGES = [
  ({ title, cleared, total }) => `${cleared} of ${total} tiles cleared on ${title}. Come take the rest.`,
  ({ title, pct }) => `${title} is ${pct}% cleared. Get in before the good tiles are gone.`,
  ({ title, left }) => `Only ${left} tiles left on ${title}. Think you can make a difference?`,
  ({ title, pct }) => `${title} is ${pct}% cleared, and I'm not slowing down.`,
  ({ title }) => `I'm clearing ${title} right now. Grab a pair before I do.`,
  ({ title, left }) => `${left} tiles remain on ${title}. Your move.`,
  ({ title }) => `${title} is underway. Come steal a few pairs while you still can.`,
  ({ title, pct }) => `We're ${pct}% through ${title}. Plenty of time to catch up. Probably.`,
  ({ title, left }) => `${title}: ${left} tiles left and no mercy promised.`,
  ({ title }) => `Think you're faster? Jump into ${title} and prove it.`,
  ({ title, cleared }) => `${cleared} tiles down on ${title}. Don't leave me all the glory.`,
  ({ title }) => `The easy pairs on ${title} are disappearing. Tap in.`,
];

const RESULT_MESSAGES = [
  ({ title, elapsed }) => `I cleared ${title} in ${elapsed}. Your turn.`,
  ({ title, elapsed }) => `${title}: cleared in ${elapsed}. Think you can beat it?`,
  ({ title, elapsed }) => `The bar for ${title} is now ${elapsed}. You're welcome to try.`,
  ({ title, elapsed }) => `I made short work of ${title}: ${elapsed}. Beat that.`,
  ({ title, elapsed }) => `${title} fell in ${elapsed}. A rematch seems fair.`,
  ({ title, elapsed }) => `Done with ${title} in ${elapsed}. Surely you can do better?`,
  ({ title, elapsed }) => `My time on ${title}: ${elapsed}. No pressure—just evidence.`,
  ({ title, elapsed }) => `${elapsed} on ${title}. Come defend your reputation.`,
  ({ title, pairs }) => `I took ${pairs} pairs on ${title}. How many can you claim?`,
  ({ title, rank, playerCount }) => `I finished #${rank} of ${playerCount} on ${title}. Come change the standings.`,
];

const NOTICE_MESSAGES = [
  ({ fromUser, roomTitle }) => `${fromUser} has claimed ${roomTitle}. Think you can take more pairs?`,
  ({ fromUser, roomTitle }) => `${fromUser} wants competition at ${roomTitle}. You were the obvious choice.`,
  ({ fromUser, roomTitle }) => `${fromUser} saved you a seat at ${roomTitle}. Try not to waste it.`,
  ({ fromUser, roomTitle }) => `${roomTitle} is open, and ${fromUser} is already feeling confident.`,
  ({ fromUser, roomTitle }) => `Come steal a few pairs from ${fromUser} at ${roomTitle}.`,
];

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
