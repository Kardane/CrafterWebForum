#!/bin/bash
# legacy: WSL (Ubuntu) helper script only
# for Windows native setup, use npm run dev
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /home/parkj_ubuntu/projects/CrafterForumWeb_NextJS
echo "Starting Next.js dev server..."
npm run dev
