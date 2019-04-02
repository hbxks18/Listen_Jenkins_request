#!/bin/sh
if which yarn 2>/dev/null; then
    echo 'yarn \c'
    yarn -v
    yarn --ignore-engines
    yarn start
else
    echo 'npm \c'
    npm -v
    npm install
    npm run start
fi
