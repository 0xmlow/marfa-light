#!/bin/zsh
# Hourly during the Ethereum sale (launchd: ~/Library/LaunchAgents/com.mlow.marfa-thumbs.plist).
# Renders day GIFs + traits for any newly minted token, publishes them, and unloads itself
# once all 111 are minted and rendered.
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
# all minted and every one rendered: the job is finished
DONE=$(node -e '
  const fs=require("fs"); const t=JSON.parse(fs.readFileSync("thumbs/1-'"${ADDR:l}"'.json","utf8"));
  console.log(Object.keys(t).length>=111 ? "yes" : "no");' 2>/dev/null)
if [ "$DONE" = yes ]; then
  echo "all 111 rendered; unloading the hourly job"
  launchctl bootout gui/$(id -u)/com.mlow.marfa-thumbs
fi
