const FALLBACK_ORIGIN = "https://florentinapanaofficial.ro";
function normalise(raw) {
  return null;
}
const ALLOWED_ORIGINS = new Set(
  [
    normalise(),
    normalise(),
    FALLBACK_ORIGIN
  ].filter((v) => v !== null)
);
function checkOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin === null) {
    return { allowed: true, origin: null };
  }
  if (ALLOWED_ORIGINS.has(origin)) {
    return { allowed: true, origin };
  }
  return { allowed: false, origin: null };
}

export { checkOrigin as c };
