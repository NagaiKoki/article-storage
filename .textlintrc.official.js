const base = require("./.textlintrc.base.js");

module.exports = {
  rules: {
    ...base.rules,
    "preset-ja-technical-writing": {
      "ja-no-weak-phrase": false,
    },
  },
};
