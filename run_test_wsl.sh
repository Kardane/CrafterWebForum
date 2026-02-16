#!/bin/bash
# legacy: WSL (Ubuntu) helper script only
# for Windows native setup, use npm test
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /home/parkj_ubuntu/projects/CrafterForumWeb_NextJS
npm test "$@"
