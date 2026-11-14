import type { Metrics, PreSimResult, Verification } from "../../contract/types";
import { metricNames } from "./presim";
export function verify(result: PreSimResult, actual: Metrics): Verification {
  const checks = metricNames.map((metric) => {
    const d = result.plan[metric],
      a = actual[metric],
      eps = 1e-8;
    const classification =
      a < d.min - eps || a > d.max + eps
        ? "FAIL"
        : a < d.p10 - eps || a > d.p90 + eps
          ? "DRIFT"
          : "PASS";
    return {
      metric,
      actual: a,
      ...d,
      result: classification as Verification["result"],
    };
  });
  return {
    planId: result.planId,
    result: checks.some((c) => c.result === "FAIL")
      ? "FAIL"
      : checks.some((c) => c.result === "DRIFT")
        ? "DRIFT"
        : "PASS",
    checks,
  };
}
