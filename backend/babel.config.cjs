// Allows using ESM syntax with Jest

module.exports = {
  presets: [['@babel/preset-env', {targets: {node: 'current'}}]],
};