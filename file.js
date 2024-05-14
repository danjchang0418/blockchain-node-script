const fs = require("fs");

const fileContents = fs.readFileSync('./script.js', 'utf8');
eval(fileContents);