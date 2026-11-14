import evidence from "../../data/ml/evidence_v1.json";
import activeReplay from "../../data/ml/browser_replay_v1.json";

const fmt = (value: number) => Math.round(value).toLocaleString();

/** Static, versioned research evidence; never presented as the live city tick. */
export function mlEvidence() {
  const activeMetrics = activeReplay.metrics.map((row) =>
    `<tr><td>${row.hourAhead} h</td><td>${row.xgboostMaeKw.toFixed(2)}</td><td>${row.previousDayMaeKw.toFixed(2)}</td></tr>`,
  ).join("");
  const readings = activeReplay.meterReadings.map((row) =>
    `<tr><td>${row.hourAhead} h</td><td>${row.meter}</td><td>${row.predictedKw.toFixed(2)}</td><td>${row.actualKw.toFixed(2)}</td><td>${row.bufferedKw.toFixed(2)}</td></tr>`,
  ).join("");
  const forecastRows = evidence.forecastMetrics.map((row) =>
    `<tr><td>${row.hour_ahead} h</td><td>${row.xgboost_mae_kw.toFixed(2)}</td><td>${row.previous_day_mae_kw.toFixed(2)}</td><td>${row.informer_mae_kw.toFixed(2)}</td></tr>`,
  ).join("");
  const episodeRows = evidence.rows.map((row) =>
    `<tr><td>${row.date}</td><td>${fmt(row.council100)}</td><td>${fmt(row.council85)}</td><td>${fmt(row.staticPriority)}</td></tr>`,
  ).join("");
  return `<section class="ml-evidence" aria-label="Historical machine learning evidence">
    <p><strong>Trained electricity model</strong> · XGBoost · 10 measured customer meters · 3-hour demand forecast</p>
    <p><strong>Selected held-out date:</strong> ${activeReplay.origin.slice(0, 10)} · saved model ${activeReplay.modelSha256.slice(0, 12)}. This browser replay uses the predictions below.</p>
    <div class="ml-evidence-scroll"><table><caption>Selected date MAE, kW</caption><thead><tr><th>Horizon</th><th>XGBoost</th><th>Yesterday</th></tr></thead><tbody>${activeMetrics}</tbody></table></div>
    <details><summary>Inspect selected date predictions and measured readings</summary><div class="ml-evidence-scroll"><table><thead><tr><th>Horizon</th><th>Meter</th><th>Predicted kW</th><th>Measured kW</th><th>Buffered kW</th></tr></thead><tbody>${readings}</tbody></table></div></details>
    <p>Held-out test forecast error (MAE, kW; lower is better):</p>
    <div class="ml-evidence-scroll"><table><thead><tr><th>Horizon</th><th>XGBoost</th><th>Yesterday</th><th>Informer</th></tr></thead><tbody>${forecastRows}</tbody></table></div>
    <p><strong>Decision replay:</strong> ${evidence.policy.confirmationDays} separate test days. The council using buffered XGBoost and the selected 100% scripted-supply policy had lower modeled service loss than its 85% policy on ${evidence.policy.betterThan85Days} days. Median paired improvement: ${fmt(evidence.policy.medianPairedImprovementVs85)} synthetic service-loss person-hours.</p>
    <p>Static priority still beat that council on ${evidence.policy.confirmationDays - evidence.policy.betterThanStaticDays} days. Median modeled service loss: council ${fmt(evidence.policy.medianSyntheticServiceLoss.council100)}; static ${fmt(evidence.policy.medianSyntheticServiceLoss.staticPriority)}.</p>
    <details><summary>Inspect all ${evidence.policy.confirmationDays} comparison days</summary><div class="ml-evidence-scroll"><table><thead><tr><th>Date</th><th>Council 100%</th><th>Council 85%</th><th>Static</th></tr></thead><tbody>${episodeRows}</tbody></table></div></details>
    <p class="council-note">${evidence.limitations} This panel reports an offline replay, separate from the live city. Model ${evidence.modelSha256.slice(0, 12)} · <a href="${evidence.dataSource}" target="_blank" rel="noopener noreferrer">dataset source</a>.</p>
  </section>`;
}
