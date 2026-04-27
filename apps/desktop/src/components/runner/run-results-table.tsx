import type { RequestRunResult } from "@apiark/types";
import { Check, X, AlertCircle } from "lucide-react";

interface RunResultsTableProps {
  results: RequestRunResult[];
}

export function RunResultsTable({ results }: RunResultsTableProps) {
  if (results.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-(--color-text-dimmed)">
        No results yet
      </p>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-(--color-border) text-left text-xs text-(--color-text-muted)">
            <th className="px-3 py-2 w-8"></th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 w-16">Method</th>
            <th className="px-3 py-2 w-16">Status</th>
            <th className="px-3 py-2 w-20 text-right">Time</th>
            <th className="px-3 py-2 w-24 text-right">Tests</th>
            <th className="px-3 py-2 w-24 text-right">Asserts</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, i) => (
            <tr
              key={i}
              className="border-b border-(--color-border) hover:bg-(--color-elevated)"
            >
              <td className="px-3 py-2">
                {result.error ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : result.passed ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-red-500" />
                )}
              </td>
              <td className="px-3 py-2 text-(--color-text-primary)">
                {result.name}
                {result.error && (
                  <span className="ml-2 text-xs text-red-400">{result.error}</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs font-mono text-(--color-text-muted)">
                {result.method}
              </td>
              <td className="px-3 py-2">
                {result.status ? (
                  <span
                    className={`text-xs font-mono ${
                      result.status < 300
                        ? "text-green-500"
                        : result.status < 400
                          ? "text-yellow-500"
                          : "text-red-500"
                    }`}
                  >
                    {result.status}
                  </span>
                ) : (
                  <span className="text-xs text-(--color-text-dimmed)">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-xs text-(--color-text-muted)">
                {result.timeMs != null ? `${result.timeMs}ms` : "—"}
              </td>
              <td className="px-3 py-2 text-right text-xs">
                {result.testCount > 0 ? (
                  <span className={result.testPassed === result.testCount ? "text-green-500" : "text-red-500"}>
                    {result.testPassed}/{result.testCount}
                  </span>
                ) : (
                  <span className="text-(--color-text-dimmed)">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-xs">
                {result.assertionCount > 0 ? (
                  <span className={result.assertionPassed === result.assertionCount ? "text-green-500" : "text-red-500"}>
                    {result.assertionPassed}/{result.assertionCount}
                  </span>
                ) : (
                  <span className="text-(--color-text-dimmed)">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
