/**
 * Defence-in-depth against NoSQL operator injection.
 *
 * Always strips keys starting with `$` (the real operator-injection vector,
 * incl. bracket-notation like `?x[$gt]=`). Dotted keys are only stripped from
 * the request BODY — NOT from query/params — because legitimate query params
 * can contain dots (e.g. Meta's webhook `hub.verify_token` / `hub.challenge`),
 * and we never use a user-supplied key as a Mongo query field anyway.
 *
 * @param {object} obj
 * @param {boolean} stripDots  also delete keys containing `.`
 */
const scrub = (obj, stripDots) => {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || (stripDots && key.includes('.'))) {
      delete obj[key];
      continue;
    }
    const val = obj[key];
    if (val && typeof val === 'object') scrub(val, stripDots);
  }
};

const mongoSanitize = (req, res, next) => {
  scrub(req.body, true); // body: strip $ and dotted keys
  scrub(req.query, false); // query: strip $ only (keep dotted params like hub.*)
  scrub(req.params, false);
  next();
};

export default mongoSanitize;
