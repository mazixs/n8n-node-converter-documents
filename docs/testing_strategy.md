# Testing Strategy

## Test Structure Overview

The project follows a comprehensive testing approach with unit and integration tests organized in the `test/` directory:

```
test/
├── unit/                   # Unit tests for individual components
│   ├── errors.test.ts      # Error class testing
│   ├── helpers.test.ts     # Helper function testing
│   ├── strategies.test.ts  # Format processor testing
│   └── yml-processor.test.ts # YML-specific testing
├── integration/            # Integration tests with real files
│   ├── real-files.test.ts  # End-to-end file processing
│   └── yml-integration.test.ts # YML catalog processing
├── samples/                # Test files for various formats
├── fixtures/               # Test data and expected outputs
└── setup.ts               # Jest test environment setup
```

## Testing Philosophy

### Unit Testing
- **Error Classes**: Validate custom error types and inheritance
- **Helper Functions**: Test utility functions in isolation
- **Strategy Functions**: Test individual format processors
- **YML Processing**: Specialized tests for Yandex Market catalog parsing

### Integration Testing
- **Real File Processing**: End-to-end tests with actual document files
- **Format Compatibility**: Verify support for all advertised formats
- **Error Scenarios**: Test handling of corrupted or invalid files
- **Performance**: Validate processing times and memory usage

## Test Configuration

### Jest Configuration (`jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000, // 30s timeout for file processing tests
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
```

### Test Commands
```bash
npm test             # Run all tests
npm run test:watch   # Jest in watch mode
npm run test:coverage # Generate coverage reports
```

## Sample Files for Testing

The `test/samples/` directory contains various file formats for comprehensive testing:

- **Office Documents**: sample4.docx, sample1.rtf
- **Spreadsheets**: sample2.xlsx, sample3.csv, sample3.ods
- **Presentations**: sample1.odp
- **PDFs**: sample3.pdf
- **Data Files**: nested-objects.json, sample_yandex_market.yml
- **Web Files**: sample1.html, sample2.html
- **Text Files**: sample1.txt
- **Large Files**: large-dataset.xml

## Testing Best Practices

### File Processing Tests
- Use real files to test actual parsing capabilities
- Test both successful processing and error scenarios
- Validate output structure and content accuracy
- Check memory usage for large files

### Error Handling Tests
- Test all custom error types
- Validate error messages are user-friendly
- Ensure proper error propagation
- Test fallback mechanisms

### Performance Tests
- Measure processing time for different file sizes
- Test concurrent processing limits
- Validate memory usage patterns
- Test streaming for large files

## Continuous Integration

Tests run automatically on:
- **GitHub Actions**: Node.js 18.x and 20.x
- **Pull Requests**: All tests must pass
- **Security Checks**: npm audit integration
- **Coverage Reports**: Generated and tracked

## Test Data Management

### Fixtures
- Expected output data for validation
- Configuration files for test scenarios
- Mock data for unit tests

### Sample Files
- Real-world documents for integration testing
- Various file sizes and complexities
- Edge cases and corrupted files
- Different encoding scenarios

## Coverage Goals

- **Unit Tests**: >80% code coverage
- **Integration Tests**: All supported formats
- **Error Scenarios**: All error types covered
- **Performance**: Large file handling validated