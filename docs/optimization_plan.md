# Performance Optimization Strategies

## Current Architecture Status

### ✅ Implemented Optimizations

1. **Strategy Pattern Implementation**
   - Format-specific processors in strategies object
   - Intelligent fallback system for better compatibility
   - Custom error hierarchy for specific failure modes

2. **Performance Enhancements**
   - Promise pooling for concurrent processing limits
   - Stream processing for large files (CSV, TXT)
   - Memory-efficient processing with configurable limits
   - Input validation and sanitization at boundaries

3. **Hybrid Processing Approach**
   - officeparser as primary library for most formats
   - Intelligent fallbacks: mammoth (DOCX), pdf-parse (PDF)
   - ExcelJS for structured Excel data extraction
   - Specialized YML processing for Yandex Market catalogs

4. **Security and Validation**
   - XSS protection with sanitize-html
   - File type detection and validation
   - Path traversal protection
   - Size limits and memory management

### 📊 Current Dependencies Analysis

| Library | Version | Role | Status | Bundle Impact |
|---------|---------|------|--------|---------------|
| officeparser | 5.1.1 | 🎯 Primary: DOCX, PPTX, PDF, ODT | ✅ Optimized | High |
| exceljs | 4.4.0 | 🎯 Primary: XLSX structure | ✅ Required | High |
| mammoth | 1.9.1 | 🔄 Fallback: DOCX | ✅ Optimized | Medium |
| pdf-parse | 1.1.1 | 🔄 Fallback: PDF | ✅ Optimized | Medium |
| papaparse | 5.5.3 | 🎯 Primary: CSV | ✅ Required | Low |
| cheerio | 1.1.0 | 🎯 Primary: HTML | ✅ Required | Medium |
| xml2js | 0.6.2 | 🎯 Primary: XML/YML | ✅ Required | Low |
| chardet | 2.1.0 | 🛠️ Utility: encoding detection | ✅ Required | Low |
| iconv-lite | 0.6.3 | 🛠️ Utility: encoding conversion | ✅ Required | Low |
| file-type | 21.0.0 | 🛠️ Utility: file detection | ✅ Required | Low |
| sanitize-html | 2.17.0 | 🛡️ Security: XSS protection | ✅ Required | Medium |

**Total Production Dependencies**: 11
**Bundle Size**: ~9.5MB
**Test Coverage**: Available in test/ directory

## 🚀 Future Optimization Opportunities

### Phase 1: Experimental Replacement (Low Risk)

#### 1.1 Testing officeparser for PDF
```bash
# Experiment: Complete replacement of pdf-parse with officeparser
# Benefits: 
# - Fewer dependencies
# - officeparser uses pdf.js (more modern)
# - Architecture uniformity
```

**Testing Plan:**
- Create test files of different PDF types
- Compare text extraction quality
- Measure performance
- Test error handling

#### 1.2 Analysis of mammoth replacement possibility
```bash
# Experiment: Complete replacement of mammoth with officeparser for DOCX
# Benefits:
# - Architecture simplification
# - Fewer dependencies
# - Uniformity
```

### Phase 2: Advanced Optimization (Medium Risk)

#### 2.1 Research xml2js alternatives
- Consider built-in Node.js capabilities
- Study lighter alternatives
- Evaluate performance impact

#### 2.2 Cheerio optimization
- Analyze cheerio usage only for HTML parsing
- Possibility of using lighter alternatives for simple cases

### Phase 3: Architectural Improvements (High Risk)

#### 3.1 Creating unified parser
```typescript
// Concept: universal parser with plugins
interface UniversalParser {
  parse(buffer: Buffer, options: ParseOptions): Promise<ParseResult>;
  registerPlugin(plugin: ParserPlugin): void;
}
```

#### 3.2 Microservice architecture
- Separate parsing into individual modules
- Horizontal scaling capability
- Error isolation

## 📈 Optimization Evaluation Metrics

### Current Metrics
- Dependencies: 11 production + 19 dev
- Bundle size: ~9.5MB
- Test coverage: Available in test/ directory
- Supported formats: 14 (DOCX, XML, XLSX, CSV, PDF, TXT, PPTX, HTML, HTM, ODT, ODP, ODS, JSON, YML)

### Target Metrics
- Dependencies: 8-9 production
- Bundle size: <8MB
- Test coverage: >80%
- Performance: No degradation

## 🔬 Research Tasks

### Alternative Libraries
1. **office-text-extractor** - Alternative to officeparser
2. **node-office-parser** - Different parsing approach
3. **pdf2pic + OCR** - For complex PDF files

### New Capabilities
1. **OCR integration** - For images in documents
2. **Streaming parsing** - For very large files
3. **Caching** - For repeatedly processed files

## ⚠️ Risks and Limitations

### High Risk
- Changing core libraries may break compatibility
- Performance may degrade
- Text extraction quality may suffer

### Medium Risk
- Increased development time
- Need for additional testing
- Possible regressions

### Low Risk
- Improving fallback mechanisms
- Adding new formats
- Optimizing existing code

## 📅 Recommended Implementation Plan

### Week 1-2: Research
- Testing officeparser vs pdf-parse
- Testing officeparser vs mammoth
- Creating benchmarks

### Week 3-4: Experimental Implementation
- Creating feature flags for new parsers
- A/B testing
- Metrics collection

### Week 5-6: Finalization
- Data-driven decision making
- Documentation updates
- New version release

## 💡 Conclusion

The project has already achieved a good level of optimization. Further improvements should be based on:
1. Real performance metrics
2. User needs
3. Cost/benefit analysis

**Priority**: First fix compatibility issues (✅ completed), then optimize performance. 

## OCR for PDF (New Capability)

### Problem
Current PDF parsers (officeparser, pdf-parse) cannot handle:
- Scanned documents
- PDFs with text images
- Handwritten documents in PDF format

### Solution: pdf-to-png-converter + tesseract.js

**Benefits:**
- ✅ OCR for scanned PDFs
- ✅ Support for 100+ languages
- ✅ No system dependencies (unlike pdf2pic)
- ✅ Works with Buffer (no file system required)
- ✅ Progress tracking
- ✅ Parallel page processing

**Integration Architecture:**
```
PDF → pdf-to-png-converter → PNG Pages → tesseract.js → Text → JSON
```

**New Dependencies:**
```json
{
  "pdf-to-png-converter": "^3.6.5",
  "tesseract.js": "^5.x.x"
}
```

**PDF Processing Logic:**
1. **First Level:** officeparser (fast, text PDFs)
2. **Second Level:** pdf-parse (fallback for text PDFs)
3. **Third Level:** OCR (for scanned PDFs)

**PDF Type Detection:**
- If extracted text < 50 characters → likely scanned
- Automatic transition to OCR processing

**OCR Settings:**
```javascript
{
  viewportScale: 2.0,        // High quality for better OCR
  verbosityLevel: 0,         // Minimal logs
  pagesToProcess: [1, 2, 3], // Page limit for performance
  outputFolder: undefined    // Buffer only, no files
}
```

### Size and Performance

**Additional Size:**
- pdf-to-png-converter: ~30KB
- tesseract.js: ~2-3MB (core + language data)

**Trade-offs:**
- ➕ Significantly expanded capabilities
- ➕ Processing previously inaccessible documents
- ➖ Bundle size increase by ~3MB
- ➖ Slower processing for OCR

**Optimizations:**
- Lazy loading tesseract.js only when needed
- Language data caching
- Limit number of processed pages

## Final Plan

### Short-term Goals (1-2 weeks)
1. ✅ Implement OCR support for PDF
2. Test OCR quality on real documents
3. Optimize OCR performance

### Medium-term Goals (1-2 months)
1. Phase 1: Test main parser replacements
2. A/B test extraction quality
3. Measure performance impact

### Long-term Goals (3-6 months)
1. Phase 2-3: Architectural optimizations
2. Modular loading system
3. Achieve target size of 6-7MB

### Expected Results
- **Functionality:** Significantly expanded (OCR support)
- **Bundle Size:** Increase by ~3MB (but with new capabilities)
- **Dependencies:** 11 → 13 (with OCR) or 11 → 8-9 (after optimization)
- **Compatibility:** 100% backward compatibility
- **Performance:** Maintained for regular documents, expanded for scanned ones

## Risk Mitigation

### High Risks
1. **Bundle Size:** OCR adds ~3MB
   - *Mitigation:* Lazy loading, optional feature
   
2. **OCR Performance:** Slow processing
   - *Mitigation:* Page limits, caching, progress indicator

### Medium Risks
1. **OCR Quality:** May be worse than original text
   - *Mitigation:* Use OCR only for scanned PDFs
   
2. **Compatibility:** tesseract.js may require specific settings
   - *Mitigation:* Thorough testing in different environments

### Low Risks
1. **Dependencies:** Adding new dependencies
   - *Mitigation:* Chosen stable, popular libraries

## Conclusion

OCR integration will significantly expand node functionality, enabling processing of scanned documents and PDFs with text images. This is especially valuable for:

- Digitizing archival documents
- Processing scanned forms
- Extracting text from images in PDFs
- Working with documents created from photos

It's recommended to start with OCR support implementation as an additional feature, then continue optimizing existing dependencies. 