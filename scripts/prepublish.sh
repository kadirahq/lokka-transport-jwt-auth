echo "> Start transpiling ES2015"
echo ""
mkdir -p ./dist
./node_modules/.bin/babel --plugins "transform-runtime" src --ignore __tests__ --out-dir ./dist
echo ""
echo "> Complete transpiling ES2015"
