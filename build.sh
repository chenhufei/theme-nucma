#!/bin/bash

mkdir -p dist
VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\([^"]*\)".*/\1/')

cd ..
zip -r "theme-nucma/dist/theme-nucma-${VERSION}.zip" theme-nucma -x "theme-nucma/.git/*" "theme-nucma/dist/*" "theme-nucma/node_modules/*" "theme-nucma/build/*"
cd theme-nucma

echo "✅ 主题已打包: dist/theme-nucma-${VERSION}.zip"
