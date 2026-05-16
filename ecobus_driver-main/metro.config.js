const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-screens 4.23+ lib/module/fabric/ files contain raw
// codegenNativeComponent calls that babel-preset-expo's bundled codegen
// version cannot parse. Redirect to the pre-compiled CommonJS output
// which has no codegenNativeComponent calls.
const screensIndex = path.resolve(
  __dirname,
  'node_modules/react-native-screens/lib/commonjs/index.js'
);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-screens') {
    return { filePath: screensIndex, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
