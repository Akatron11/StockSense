import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { roleLabel } from "../auth/roleLabels";
import { AppShell } from "../components/AppShell";
import { createCompany } from "../api/companies";
import { createRegion, createBranch } from "../api/org";
import { createEmployee } from "../api/employees";
import { apiErrorMessage } from "../api/client";

// backend/app/routers/employees.py::CREATABLE_ROLES["vendor_manager"] ile birebir eşleşir.
const ALL_ROLES = [
  "general_manager",
  "company_it",
  "region_manager",
  "branch_manager",
  "cashier",
  "stock_manager",
  "seller_manager",
  "operations_chief",
  "staff",
];

// backend/app/routers/employees.py::_VENDOR_BRANCH_SCOPED_ROLES ile birebir eşleşir.
const BRANCH_SCOPED_ROLES = new Set([
  "branch_manager",
  "cashier",
  "stock_manager",
  "seller_manager",
  "operations_chief",
  "staff",
]);

// backend/app/services/manager_pin.py::PIN_APPROVER_ROLES ile birebir eşleşir.
const PIN_APPROVER_ROLES = new Set(["stock_manager", "seller_manager", "operations_chief"]);

let nextDraftId = 1;
function newDraftId(): string {
  return String(nextDraftId++);
}

interface RegionDraft {
  draftId: string;
  name: string;
  createdId: number | null;
}

interface BranchDraft {
  draftId: string;
  regionDraftId: string;
  name: string;
  createdId: number | null;
}

interface UserDraft {
  draftId: string;
  role: string;
  first_name: string;
  last_name: string;
  age: string;
  address: string;
  username: string;
  password: string;
  manager_pin: string;
  targetRegionDraftId: string;
  targetBranchDraftId: string;
  createdId: number | null;
}

function emptyUserDraft(): UserDraft {
  return {
    draftId: newDraftId(),
    role: "general_manager",
    first_name: "",
    last_name: "",
    age: "",
    address: "",
    username: "",
    password: "",
    manager_pin: "",
    targetRegionDraftId: "",
    targetBranchDraftId: "",
    createdId: null,
  };
}

// PROCESS.md Faz "Day-0 (UC-17)" — Satıcı Yöneticisi'nin yeni bir müşteriyi (şirket+bölge+şube+tam
// org şeması) tek bir sihirbazda kurabilmesi. Detay: docs/superpowers/specs/2026-08-13-day0-vendor-
// setup-design.md. Steady-state bölge/şube ekleme (general_manager'a açılması) bu sayfanın kapsamı
// dışında, kavramsal karar verildi ama implement edilmedi.
export function Day0SetupPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [createdCompanyId, setCreatedCompanyId] = useState<number | null>(null);

  const [regions, setRegions] = useState<RegionDraft[]>([{ draftId: newDraftId(), name: "", createdId: null }]);
  const [branches, setBranches] = useState<BranchDraft[]>([]);
  const [users, setUsers] = useState<UserDraft[]>([emptyUserDraft()]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function addRegion() {
    setRegions((prev) => [...prev, { draftId: newDraftId(), name: "", createdId: null }]);
  }

  function updateRegionName(draftId: string, name: string) {
    setRegions((prev) => prev.map((r) => (r.draftId === draftId ? { ...r, name } : r)));
  }

  function addBranch(regionDraftId: string) {
    setBranches((prev) => [...prev, { draftId: newDraftId(), regionDraftId, name: "", createdId: null }]);
  }

  function updateBranchName(draftId: string, name: string) {
    setBranches((prev) => prev.map((b) => (b.draftId === draftId ? { ...b, name } : b)));
  }

  function addUser() {
    setUsers((prev) => [...prev, emptyUserDraft()]);
  }

  function updateUser(draftId: string, patch: Partial<UserDraft>) {
    setUsers((prev) => prev.map((u) => (u.draftId === draftId ? { ...u, ...patch } : u)));
  }

  const hasGeneralManager = users.some((u) => u.role === "general_manager" && u.first_name.trim());
  const canProceedFromStep1 = companyName.trim().length > 0 && subdomain.trim().length > 0;
  const canProceedFromStep2 = regions.some((r) => r.name.trim());
  const canProceedFromStep3 = branches.some((b) => b.name.trim());
  const canProceedFromStep4 = hasGeneralManager;

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let companyId = createdCompanyId;
      if (companyId === null) {
        const company = await createCompany(token, { name: companyName.trim(), subdomain: subdomain.trim() });
        companyId = company.id;
        setCreatedCompanyId(companyId);
      }

      const nextRegions = [...regions];
      for (let i = 0; i < nextRegions.length; i++) {
        if (nextRegions[i].createdId === null && nextRegions[i].name.trim()) {
          const created = await createRegion(token, { company_id: companyId, name: nextRegions[i].name.trim() });
          nextRegions[i] = { ...nextRegions[i], createdId: created.id };
          setRegions([...nextRegions]);
        }
      }

      const nextBranches = [...branches];
      for (let i = 0; i < nextBranches.length; i++) {
        if (nextBranches[i].createdId === null && nextBranches[i].name.trim()) {
          const regionDraft = nextRegions.find((r) => r.draftId === nextBranches[i].regionDraftId);
          if (!regionDraft?.createdId) continue;
          const created = await createBranch(token, { region_id: regionDraft.createdId, name: nextBranches[i].name.trim() });
          nextBranches[i] = { ...nextBranches[i], createdId: created.id };
          setBranches([...nextBranches]);
        }
      }

      const nextUsers = [...users];
      for (let i = 0; i < nextUsers.length; i++) {
        const u = nextUsers[i];
        if (u.createdId !== null || !u.first_name.trim()) continue;
        const targetRegion = nextRegions.find((r) => r.draftId === u.targetRegionDraftId);
        const targetBranch = nextBranches.find((b) => b.draftId === u.targetBranchDraftId);
        const created = await createEmployee(token, {
          first_name: u.first_name.trim(),
          last_name: u.last_name.trim(),
          role: u.role,
          age: Number(u.age),
          address: u.address.trim(),
          username: u.username.trim(),
          password: u.password,
          company_id: companyId,
          region_id: u.role === "region_manager" ? targetRegion?.createdId ?? undefined : undefined,
          branch_id: BRANCH_SCOPED_ROLES.has(u.role) ? targetBranch?.createdId ?? undefined : undefined,
          manager_pin: PIN_APPROVER_ROLES.has(u.role) && u.manager_pin ? u.manager_pin : undefined,
        });
        nextUsers[i] = { ...nextUsers[i], createdId: created.id };
        setUsers([...nextUsers]);
      }

      setDone(true);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, t("day0.submitFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AppShell pageTitle={t("nav.day0Setup")}>
        <div className="panel">
          <div className="panel-body">
            <div className="hintbox">{t("day0.doneMessage", { name: companyName })}</div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle={t("nav.day0Setup")}>
      <div className="scope">{t("day0.stepIndicator", { step, total: 5 })}</div>

      <div className="panel">
        <div className="panel-body">
          {step === 1 && (
            <>
              <div className="field">
                <label>{t("day0.companyName")}</label>
                <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="field">
                <label>{t("day0.subdomain")}</label>
                <input className="input" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {regions.map((r) => (
                <div className="field" key={r.draftId}>
                  <label>{t("day0.regionName")}</label>
                  <input className="input" value={r.name} onChange={(e) => updateRegionName(r.draftId, e.target.value)} />
                </div>
              ))}
              <button className="btn sm ghost" onClick={addRegion}>{t("day0.addRegion")}</button>
            </>
          )}

          {step === 3 && (
            <>
              {regions.filter((r) => r.name.trim()).map((r) => (
                <div key={r.draftId} className="field">
                  <label>{t("day0.branchesForRegion", { region: r.name })}</label>
                  {branches.filter((b) => b.regionDraftId === r.draftId).map((b) => (
                    <input
                      key={b.draftId}
                      className="input"
                      style={{ marginBottom: 6 }}
                      value={b.name}
                      onChange={(e) => updateBranchName(b.draftId, e.target.value)}
                    />
                  ))}
                  <button className="btn sm ghost" onClick={() => addBranch(r.draftId)}>{t("day0.addBranch")}</button>
                </div>
              ))}
            </>
          )}

          {step === 4 && (
            <>
              {users.map((u) => (
                <div key={u.draftId} className="panel" style={{ marginBottom: 12 }}>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="field">
                        <label>{t("day0.userRole")}</label>
                        <select
                          className="input"
                          value={u.role}
                          onChange={(e) => updateUser(u.draftId, { role: e.target.value, targetRegionDraftId: "", targetBranchDraftId: "" })}
                        >
                          {ALL_ROLES.map((role) => (
                            <option key={role} value={role}>{roleLabel(t, role)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>{t("common.firstName")}</label>
                        <input className="input" value={u.first_name} onChange={(e) => updateUser(u.draftId, { first_name: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>{t("common.lastName")}</label>
                        <input className="input" value={u.last_name} onChange={(e) => updateUser(u.draftId, { last_name: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>{t("common.age")}</label>
                        <input className="input" type="number" min={0} value={u.age} onChange={(e) => updateUser(u.draftId, { age: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>{t("common.address")}</label>
                        <input className="input" value={u.address} onChange={(e) => updateUser(u.draftId, { address: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>{t("employees.username")}</label>
                        <input className="input" value={u.username} onChange={(e) => updateUser(u.draftId, { username: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>{t("employees.tempPassword")}</label>
                        <input className="input" type="password" value={u.password} onChange={(e) => updateUser(u.draftId, { password: e.target.value })} />
                      </div>
                    </div>

                    {u.role === "region_manager" && (
                      <div className="field">
                        <label>{t("employees.targetRegion")}</label>
                        <select className="input" value={u.targetRegionDraftId} onChange={(e) => updateUser(u.draftId, { targetRegionDraftId: e.target.value })}>
                          <option value="">{t("common.selectPlaceholder")}</option>
                          {regions.filter((r) => r.name.trim()).map((r) => (
                            <option key={r.draftId} value={r.draftId}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {BRANCH_SCOPED_ROLES.has(u.role) && (
                      <div className="field">
                        <label>{t("employees.targetBranch")}</label>
                        <select className="input" value={u.targetBranchDraftId} onChange={(e) => updateUser(u.draftId, { targetBranchDraftId: e.target.value })}>
                          <option value="">{t("common.selectPlaceholder")}</option>
                          {branches.filter((b) => b.name.trim()).map((b) => (
                            <option key={b.draftId} value={b.draftId}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {PIN_APPROVER_ROLES.has(u.role) && (
                      <div className="field">
                        <label>{t("employees.managerPinCreate")}</label>
                        <input className="input" value={u.manager_pin} onChange={(e) => updateUser(u.draftId, { manager_pin: e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn sm ghost" onClick={addUser}>{t("day0.addUser")}</button>
              {!hasGeneralManager && <div className="error-text">{t("day0.needGeneralManager")}</div>}
            </>
          )}

          {step === 5 && (
            <>
              <div className="field">
                <label>{t("day0.summaryCompany")}</label>
                <div>{companyName} ({subdomain})</div>
              </div>
              <div className="field">
                <label>{t("day0.summaryRegions")}</label>
                <div>{regions.filter((r) => r.name.trim()).map((r) => r.name).join(", ")}</div>
              </div>
              <div className="field">
                <label>{t("day0.summaryBranches")}</label>
                <div>{branches.filter((b) => b.name.trim()).map((b) => b.name).join(", ")}</div>
              </div>
              <div className="field">
                <label>{t("day0.summaryUsers")}</label>
                <div>
                  {users.filter((u) => u.first_name.trim()).map((u) => (
                    <div key={u.draftId}>
                      {u.first_name} {u.last_name} — {roleLabel(t, u.role)}
                      {u.createdId !== null ? ` (${t("day0.alreadyCreated")})` : ""}
                    </div>
                  ))}
                </div>
              </div>
              {submitError && <div className="error-text">{submitError}</div>}
            </>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          {step > 1 && (
            <button className="btn ghost" disabled={submitting} onClick={() => setStep((s) => s - 1)}>
              {t("day0.back")}
            </button>
          )}
          {step < 5 && (
            <button
              className="btn primary"
              disabled={
                (step === 1 && !canProceedFromStep1) ||
                (step === 2 && !canProceedFromStep2) ||
                (step === 3 && !canProceedFromStep3) ||
                (step === 4 && !canProceedFromStep4)
              }
              onClick={() => setStep((s) => s + 1)}
            >
              {t("day0.next")}
            </button>
          )}
          {step === 5 && (
            <button className="btn primary" disabled={submitting} onClick={handleSubmit}>
              {submitting ? t("common.saving") : submitError ? t("day0.retry") : t("day0.complete")}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
