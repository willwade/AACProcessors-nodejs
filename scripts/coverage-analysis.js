#!/usr/bin/env node

/**
 * Advanced coverage analysis and reporting script
 * Provides detailed insights into test coverage and identifies areas for improvement
 */

const fs = require('fs');
const path = require('path');

class CoverageAnalyzer {
  constructor(coverageDir = 'coverage') {
    this.coverageDir = coverageDir;
    this.coverageData = null;
    this.summaryData = null;
  }

  loadCoverageData() {
    try {
      const coverageJsonPath = path.join(this.coverageDir, 'coverage-final.json');
      const summaryJsonPath = path.join(this.coverageDir, 'coverage-summary.json');
      
      if (fs.existsSync(coverageJsonPath)) {
        this.coverageData = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));
      }
      
      if (fs.existsSync(summaryJsonPath)) {
        this.summaryData = JSON.parse(fs.readFileSync(summaryJsonPath, 'utf8'));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to load coverage data:', error.message);
      return false;
    }
  }

  generateDetailedReport() {
    if (!this.summaryData) {
      console.error('No coverage data available');
      return;
    }

    console.log('\n🔍 DETAILED COVERAGE ANALYSIS\n');
    console.log('=' .repeat(60));

    // Overall summary
    const total = this.summaryData.total;
    console.log('\n📊 OVERALL COVERAGE:');
    console.log(`Lines:      ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`);
    console.log(`Statements: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`);
    console.log(`Functions:  ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`);
    console.log(`Branches:   ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`);

    // Coverage by directory
    this.analyzeCoverageByDirectory();

    // Identify problem areas
    this.identifyProblemAreas();

    // Coverage trends
    this.analyzeCoverageTrends();

    // Recommendations
    this.generateRecommendations();
  }

  analyzeCoverageByDirectory() {
    console.log('\n📁 COVERAGE BY DIRECTORY:');
    
    const directoryCoverage = {};
    
    Object.entries(this.summaryData).forEach(([filePath, coverage]) => {
      if (filePath === 'total') return;
      
      const relativePath = filePath.replace(process.cwd(), '');
      const dirName = path.dirname(relativePath);
      
      if (!directoryCoverage[dirName]) {
        directoryCoverage[dirName] = {
          files: 0,
          totalLines: 0,
          coveredLines: 0,
          totalStatements: 0,
          coveredStatements: 0,
          totalFunctions: 0,
          coveredFunctions: 0,
          totalBranches: 0,
          coveredBranches: 0
        };
      }
      
      const dir = directoryCoverage[dirName];
      dir.files++;
      dir.totalLines += coverage.lines.total;
      dir.coveredLines += coverage.lines.covered;
      dir.totalStatements += coverage.statements.total;
      dir.coveredStatements += coverage.statements.covered;
      dir.totalFunctions += coverage.functions.total;
      dir.coveredFunctions += coverage.functions.covered;
      dir.totalBranches += coverage.branches.total;
      dir.coveredBranches += coverage.branches.covered;
    });

    Object.entries(directoryCoverage)
      .sort(([,a], [,b]) => {
        const aPct = a.totalLines > 0 ? (a.coveredLines / a.totalLines) * 100 : 0;
        const bPct = b.totalLines > 0 ? (b.coveredLines / b.totalLines) * 100 : 0;
        return bPct - aPct;
      })
      .forEach(([dirName, stats]) => {
        const linePct = stats.totalLines > 0 ? ((stats.coveredLines / stats.totalLines) * 100).toFixed(1) : '0.0';
        const stmtPct = stats.totalStatements > 0 ? ((stats.coveredStatements / stats.totalStatements) * 100).toFixed(1) : '0.0';
        
        console.log(`  ${dirName.padEnd(30)} ${linePct.padStart(6)}% lines, ${stmtPct.padStart(6)}% statements (${stats.files} files)`);
      });
  }

  identifyProblemAreas() {
    console.log('\n⚠️  AREAS NEEDING ATTENTION:');
    
    const problemFiles = [];
    
    Object.entries(this.summaryData).forEach(([filePath, coverage]) => {
      if (filePath === 'total') return;
      
      const relativePath = filePath.replace(process.cwd(), '').replace(/^\//, '');
      const linePct = coverage.lines.pct;
      const stmtPct = coverage.statements.pct;
      const funcPct = coverage.functions.pct;
      const branchPct = coverage.branches.pct;
      
      // Identify files with low coverage
      if (linePct < 50 || stmtPct < 50 || funcPct < 50) {
        problemFiles.push({
          file: relativePath,
          lines: linePct,
          statements: stmtPct,
          functions: funcPct,
          branches: branchPct,
          priority: this.calculatePriority(coverage)
        });
      }
    });

    problemFiles
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10) // Top 10 problem files
      .forEach(file => {
        console.log(`  🔴 ${file.file}`);
        console.log(`     Lines: ${file.lines}%, Statements: ${file.statements}%, Functions: ${file.functions}%, Branches: ${file.branches}%`);
      });

    if (problemFiles.length === 0) {
      console.log('  ✅ No major coverage issues found!');
    }
  }

  calculatePriority(coverage) {
    // Priority based on file size and coverage gaps
    const lineGap = coverage.lines.total - coverage.lines.covered;
    const stmtGap = coverage.statements.total - coverage.statements.covered;
    const funcGap = coverage.functions.total - coverage.functions.covered;
    
    return lineGap + stmtGap * 2 + funcGap * 3; // Weight functions more heavily
  }

  analyzeCoverageTrends() {
    console.log('\n📈 COVERAGE INSIGHTS:');
    
    const total = this.summaryData.total;
    
    // Coverage quality assessment
    const avgCoverage = (total.lines.pct + total.statements.pct + total.functions.pct + total.branches.pct) / 4;
    
    let quality = 'Poor';
    let emoji = '🔴';
    
    if (avgCoverage >= 90) {
      quality = 'Excellent';
      emoji = '🟢';
    } else if (avgCoverage >= 80) {
      quality = 'Good';
      emoji = '🟡';
    } else if (avgCoverage >= 70) {
      quality = 'Fair';
      emoji = '🟠';
    }
    
    console.log(`  ${emoji} Overall Quality: ${quality} (${avgCoverage.toFixed(1)}% average)`);
    
    // Identify coverage patterns
    const patterns = [];
    
    if (total.branches.pct < total.lines.pct - 20) {
      patterns.push('⚠️  Branch coverage significantly lower than line coverage - consider more conditional testing');
    }
    
    if (total.functions.pct < total.lines.pct - 15) {
      patterns.push('⚠️  Function coverage lower than line coverage - some functions may be untested');
    }
    
    if (total.statements.pct > total.lines.pct + 5) {
      patterns.push('✅ Good statement coverage relative to line coverage');
    }
    
    patterns.forEach(pattern => console.log(`  ${pattern}`));
  }

  generateRecommendations() {
    console.log('\n💡 RECOMMENDATIONS:');
    
    const total = this.summaryData.total;
    const recommendations = [];
    
    if (total.lines.pct < 80) {
      recommendations.push('Add more unit tests to increase line coverage');
    }
    
    if (total.branches.pct < 70) {
      recommendations.push('Add tests for conditional logic and error paths');
    }
    
    if (total.functions.pct < 80) {
      recommendations.push('Ensure all public methods have dedicated tests');
    }
    
    // Specific recommendations based on file analysis
    const uncoveredFiles = Object.entries(this.summaryData)
      .filter(([path, coverage]) => path !== 'total' && coverage.lines.pct < 30)
      .length;
    
    if (uncoveredFiles > 0) {
      recommendations.push(`Focus on ${uncoveredFiles} files with very low coverage first`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Coverage looks good! Consider adding property-based tests and edge cases');
    }
    
    recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }

  generateBadgeData() {
    if (!this.summaryData) return null;
    
    const total = this.summaryData.total;
    const coverage = Math.round(total.lines.pct);
    
    let color = 'red';
    if (coverage >= 90) color = 'brightgreen';
    else if (coverage >= 80) color = 'green';
    else if (coverage >= 70) color = 'yellow';
    else if (coverage >= 60) color = 'orange';
    
    return {
      schemaVersion: 1,
      label: 'coverage',
      message: `${coverage}%`,
      color: color
    };
  }

  saveBadgeData() {
    const badgeData = this.generateBadgeData();
    if (badgeData) {
      const badgePath = path.join(this.coverageDir, 'badge.json');
      fs.writeFileSync(badgePath, JSON.stringify(badgeData, null, 2));
      console.log(`\n📛 Coverage badge data saved to ${badgePath}`);
    }
  }

  generateMarkdownReport() {
    if (!this.summaryData) return '';
    
    const total = this.summaryData.total;
    
    let markdown = '# Coverage Report\n\n';
    markdown += '## Summary\n\n';
    markdown += '| Metric | Coverage | Covered/Total |\n';
    markdown += '|--------|----------|---------------|\n';
    markdown += `| Lines | ${total.lines.pct}% | ${total.lines.covered}/${total.lines.total} |\n`;
    markdown += `| Statements | ${total.statements.pct}% | ${total.statements.covered}/${total.statements.total} |\n`;
    markdown += `| Functions | ${total.functions.pct}% | ${total.functions.covered}/${total.functions.total} |\n`;
    markdown += `| Branches | ${total.branches.pct}% | ${total.branches.covered}/${total.branches.total} |\n\n`;
    
    // Add file-by-file breakdown
    markdown += '## File Coverage\n\n';
    markdown += '| File | Lines | Statements | Functions | Branches |\n';
    markdown += '|------|-------|------------|-----------|----------|\n';
    
    Object.entries(this.summaryData)
      .filter(([path]) => path !== 'total')
      .sort(([,a], [,b]) => b.lines.pct - a.lines.pct)
      .forEach(([filePath, coverage]) => {
        const relativePath = filePath.replace(process.cwd(), '').replace(/^\//, '');
        markdown += `| ${relativePath} | ${coverage.lines.pct}% | ${coverage.statements.pct}% | ${coverage.functions.pct}% | ${coverage.branches.pct}% |\n`;
      });
    
    const reportPath = path.join(this.coverageDir, 'COVERAGE.md');
    fs.writeFileSync(reportPath, markdown);
    console.log(`📄 Markdown report saved to ${reportPath}`);
    
    return markdown;
  }
}

// Main execution
if (require.main === module) {
  const analyzer = new CoverageAnalyzer();
  
  if (analyzer.loadCoverageData()) {
    analyzer.generateDetailedReport();
    analyzer.saveBadgeData();
    analyzer.generateMarkdownReport();
  } else {
    console.error('❌ Could not load coverage data. Run tests with coverage first: npm test -- --coverage');
    process.exit(1);
  }
}

module.exports = CoverageAnalyzer;
