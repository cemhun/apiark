import type { TestResult, AssertionResult } from "@apiark/types";

export function TestResultsPanel({
  testResults,
  assertionResults,
}: {
  testResults: TestResult[];
  assertionResults: AssertionResult[];
}) {
  const totalTests = testResults.length + assertionResults.length;
  const passedTests =
    testResults.filter((t) => t.passed).length +
    assertionResults.filter((a) => a.passed).length;
  const failedTests = totalTests - passedTests;

  if (totalTests === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-(--color-text-dimmed)">
        No test results. Add assertions or test scripts to see results here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 rounded bg-(--color-elevated) px-3 py-2">
        <span className="text-sm font-medium text-(--color-text-primary)">
          {totalTests} test{totalTests !== 1 ? "s" : ""}
        </span>
        {passedTests > 0 && (
          <span className="text-sm text-green-500">
            {passedTests} passed
          </span>
        )}
        {failedTests > 0 && (
          <span className="text-sm text-red-400">
            {failedTests} failed
          </span>
        )}
      </div>

      {/* Assertion results */}
      {assertionResults.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-medium text-(--color-text-muted)">
            Assertions
          </h4>
          <div className="space-y-1">
            {assertionResults.map((result, i) => (
              <AssertionResultRow key={i} result={result} />
            ))}
          </div>
        </div>
      )}

      {/* JS test results */}
      {testResults.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-medium text-(--color-text-muted)">
            Tests
          </h4>
          <div className="space-y-1">
            {testResults.map((result, i) => (
              <TestResultRow key={i} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssertionResultRow({ result }: { result: AssertionResult }) {
  return (
    <div className="flex items-start gap-2 rounded px-2 py-1.5 text-sm">
      <span className="mt-0.5 flex-shrink-0">
        {result.passed ? (
          <span className="text-green-500">&#10003;</span>
        ) : (
          <span className="text-red-400">&#10007;</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-(--color-text-primary)">
          {result.path}{" "}
          <span className="text-(--color-text-muted)">{result.operator}</span>{" "}
          <span className="font-mono text-(--color-text-secondary)">
            {formatValue(result.expected)}
          </span>
        </span>
        {!result.passed && (
          <div className="mt-0.5 text-xs text-red-400">
            Got: <span className="font-mono">{formatValue(result.actual)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TestResultRow({ result }: { result: TestResult }) {
  return (
    <div className="flex items-start gap-2 rounded px-2 py-1.5 text-sm">
      <span className="mt-0.5 flex-shrink-0">
        {result.passed ? (
          <span className="text-green-500">&#10003;</span>
        ) : (
          <span className="text-red-400">&#10007;</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-(--color-text-primary)">{result.name}</span>
        {!result.passed && result.error && (
          <div className="mt-0.5 text-xs text-red-400">{result.error}</div>
        )}
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
