import type { CouncilStore } from "../app/store";
import { needsApproval } from "../app/modes";
export function approvalBar(s: CouncilStore) {
  return `<p>${s.state} · ${s.mode.toUpperCase()}${s.state === "PreSimulating" ? ` · ${(s.progress * 100).toFixed(0)}%` : ""}</p><div class="sim-actions"><button data-action="approve" ${needsApproval(s.state) ? "" : "disabled"}>Approve exact plan</button><button data-action="reject" ${needsApproval(s.state) ? "" : "disabled"}>Reject with note</button></div>`;
}
