# TODOs

- Generalize the GitHub merge automation so any gsync team can use it without this repo's shared Firebase admin secret. Likely shape: team-scoped GitHub installation or webhook configuration plus a server-side trust model that resolves repo merges to the right team and updates plans without giving every repo direct Firestore admin access.
