# Zombie Survival in SAS-JACKY

These patches add the game to `yyb84ycgt6-oss/sasjacky777-d1033916` (branch `SAS-JACKY`): a `/zombie-survival` page in Games & Worlds, its test, docs, the nav entry and the service-worker exclusions. They were prepared on SAS-JACKY at `a961440d` and pass that repo's full suite (1,999 tests), typecheck and build.

They are kept here because this session cannot push to that repo yet: the GitHub account Claude uses (`93jessycollin93-del`) needs Write access there, and the Claude GitHub App must be installed on it.

The game's build itself is left out (it is generated). To apply:

```sh
# in sasjacky777-d1033916, on SAS-JACKY
git am /path/to/eru/zombie-survival-game/jackie-integration/*.patch
# then, in eru/zombie-survival-game
npm install && npm run build:embed -- /path/to/sasjacky777-d1033916/public/zombie-survival
# back in sasjacky777-d1033916
git add public/zombie-survival && git commit -m "Add the Zombie Survival build"
```
