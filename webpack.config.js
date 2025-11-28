const path = require('path');

module.exports = {
  entry: './dist/FileToJsonNode.node.js',
  target: 'node',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'bundle'),
    filename: 'FileToJsonNode.node.js',
    libraryTarget: 'commonjs2',
    clean: true
  },
  resolve: {
    extensions: ['.js', '.json']
  },
  externals: {
    // Исключаем n8n модули - они должны быть доступны в среде n8n
    'n8n-workflow': 'n8n-workflow',
    'n8n-core': 'n8n-core'
  },
  optimization: {
    minimize: false, // Отключаем минификацию для лучшей отладки
    splitChunks: false // Отключаем code splitting - создаем один файл
  },
  stats: {
    warnings: false
  }
}; 