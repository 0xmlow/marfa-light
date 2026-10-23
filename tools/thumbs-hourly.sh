#!/bin/zsh
# Every 10 minutes during the Ethereum sale (launchd: ~/Library/LaunchAgents/com.mlow.marfa-thumbs.plist,
# StartInterval 600). Renders day GIFs + traits for any newly minted token, publishes them, asks
# OpenSea to re-read them, and unloads itself once all 111 are minted, rendered and refreshed.
#   install:   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mlow.marfa-thumbs.plist
#   run now:   launchctl kickstart gui/$(id -u)/com.mlow.marfa-thumbs
#   stop:      launchctl bootout gui/$(id -u)/com.mlow.marfa-thumbs
#   log:       ~/Library/Logs/marfa-thumbs.log
cd "${0:A:h}/.." || exit 1
export PATH="$HOME/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export ABX_NO_UPDATE_CHECK=1
export ABX_RPC_URLS="https://rpc.mevblocker.io,https://ethereum-rpc.publicnode.com,https://eth.drpc.org"
ADDR=0x4504570d25b710942BeE78b7Ff5720950c1FC02D
echo "=== $(date -u +%FT%TZ)"
git pull --ff-only -q || echo "git pull failed (continuing)"
node tools/thumbs.mjs --chain ethereum --address $ADDR --from-block 26133300 --date 2026-10-06 || { echo "thumbs failed"; exit 1; }
# holders: owners, names and pictures for /holders/ (the page also reads owners live; this keeps
# first paint, stills and new collectors' ENS current). Commit and publish only when something changed.
node tools/holders.mjs && python3 tools/holders-media.py && {
  git add proposal-site/data/holders.json proposal-site/holders/pfp proposal-site/tokens/1/s
  if ! git diff --cached --quiet; then
    git commit -q -m "Holders: $(node -e 'const d=require("./proposal-site/data/holders.json");console.log(d.supply+" of "+d.max+" minted, "+d.holders.length+" holders")')"
    npm run publish:site || echo "publish failed"
  fi
} || echo "holders failed (continuing)"
# OpenSea grabs a token's image minutes after the mint, often before the GIF above exists, and then
# keeps the "developing" placeholder. Ask it to re-read every token whose real GIF GitHub Pages (the
# onchain image URL) now serves; if Pages is still building, wait once and try again.
OS=$(node tools/opensea-refresh.mjs --address $ADDR 2>&1); print -r -- "$OS"
if print -r -- "$OS" | grep -q "not live on GitHub Pages"; then
  sleep 120; node tools/opensea-refresh.mjs --address $ADDR 2>&1 || echo "opensea refresh failed (continuing)"
fi
# all minted, rendered and refreshed on OpenSea: the job is finished
DONE=$(node -e '
  const fs=require("fs"), a="'"${ADDR:l}"'";
  const n=f=>{try{return Object.keys(JSON.parse(fs.readFileSync(f,"utf8"))).length}catch{return 0}};
  console.log(n("thumbs/1-"+a+".json")>=111 && n("thumbs/opensea-1-"+a+".json")>=111 ? "yes" : "no");' 2>/dev/null)
if [ "$DONE" = yes ]; then
  echo "all 111 rendered and refreshed; unloading the job"
  launchctl bootout gui/$(id -u)/com.mlow.marfa-thumbs
fi
