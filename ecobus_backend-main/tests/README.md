# EcoBus backend tests

Pure-Node Jest unit tests that DO NOT require a live Postgres or Redis.
They cover validators, error helpers, route registration, and the response
envelope so we can run them in any CI environment.

The end-to-end browser smoke test in `src/public/tests.html` (served at
`/tests`) remains the source of truth for full HTTP-against-DB coverage.

## Run

```bash
npm test
```

## Layout

- `unit/` — pure functions (validators, error class, helpers)
- `routes/` — route registration / 404 / validation, with DB calls mocked