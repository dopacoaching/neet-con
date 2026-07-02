/**
 * Defence-in-depth against NoSQL operator injection.
 *
 * Strips any request keys that start with `$` or contain `.` from
 * req.body / req.query / req.params, in place. Mongoose schemas already coerce
 * most inputs to their declared types, but this stops operator objects like
 * `{ "$gt": "" }` or `{ "a.b": 1 }` from ever reaching a query builder.
 */
const scrub = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      continue;
    }
    const val = obj[key];
    if (val && typeof val === 'object') scrub(val);
  }
};

const mongoSanitize = (req, res, next) => {
  scrub(req.body);
  scrub(req.query);
  scrub(req.params);
  next();
};

export default mongoSanitize;
