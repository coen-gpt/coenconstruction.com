import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Edit2, Check, X, Users, ShieldCheck, Mail } from "lucide-react";

const PERMISSIONS = [
  { key: "can_access_leads",     label: "Leads",              desc: "View & manage leads" },
  { key: "can_access_invoices",  label: "Invoice Inbox",      desc: "View & manage invoices" },
  { key: "can_access_estimates", label: "Estimating Suite",   desc: "Projects, estimates, MTO, SoW" },
  { key: "can_access_blog",      label: "Blog Posts",         desc: "Create & edit blog content" },
  { key: "can_access_cms",       label: "CMS / Pages",        desc: "Edit site pages & content" },
  { key: "can_access_seo",       label: "SEO Tools",          desc: "SEO audits & recommendations" },
  { key: "can_access_team",      label: "Team Access",        desc: "Manage team members & roles" },
  { key: "can_access_tracking",  label: "Tracking & Code",   desc: "Analytics & tracking scripts" },
  { key: "can_access_field_crew", label: "Field Crew & Time Off", desc: "Crew dashboard, timesheets, time-off approvals" },
  { key: "can_approve_payroll",  label: "Payroll Approvals",  desc: "Review & approve weekly payroll" },
];

const ROLES = [
  "admin",
  "project_manager",
  "assistant_project_manager",
  "site_superintendent",
  "operations_manager",
  "office_admin",
  "estimator",
  "field_crew",
  "viewer",
];

const ROLE_LABELS = {
  admin: "Admin",
  project_manager: "Project Manager",
  assistant_project_manager: "Asst. PM",
  site_superintendent: "Site Superintendent",
  operations_manager: "Operations Manager",
  office_admin: "Office Admin",
  estimator: "Estimator",
  field_crew: "Field Crew",
  viewer: "Viewer",
};

const ROLE_COLORS = {
  admin:                     "bg-red-100 text-red-700",
  project_manager:           "bg-violet-100 text-violet-700",
  assistant_project_manager: "bg-purple-100 text-purple-700",
  site_superintendent:       "bg-orange-100 text-orange-700",
  operations_manager:        "bg-teal-100 text-teal-700",
  office_admin:              "bg-sky-100 text-sky-700",
  estimator:                 "bg-blue-100 text-blue-700",
  field_crew:                "bg-amber-100 text-amber-700",
  viewer:                    "bg-gray-100 text-gray-600",
};

const ROLE_DEFAULTS = {
  admin:                     { can_access_leads: true,  can_access_invoices: true,  can_access_estimates: true,  can_access_blog: true,  can_access_cms: true,  can_access_seo: true,  can_access_team: true,  can_access_tracking: true,  can_access_field_crew: true  },
  project_manager:           { can_access_leads: true,  can_access_invoices: true,  can_access_estimates: true,  can_access_blog: false, can_access_cms: false, can_access_seo: false, can_access_team: false, can_access_tracking: false, can_access_field_crew: true  },
  assistant_project_manager: { can_access_leads: true,  can_access_invoices: false, can_access_estimates: true,  can_access_blog: false, can_access_cms: false, can_access_seo: false, can_access_team: false, can_access_tracking: false, can_access_field_crew: false },
  site_superintendent:       { can_access_leads: false, can_access_invoices: false, can_access_estimates: true,  can_access_blog: false, can_access_cms: false, can_access_seo: false, can_access_team: false, can_access_tracking: false, can_access_field_crew: true  },
  operations_manager:        { can_access_leads: true,  can_access_invoices: true,  can_access_estimates: true,  can_access_blog: false, can_access_cms: false, can_access_seo: false, can_access_team: true,  can_access_tracking: false, can_access_field_crew: true  },
  office_admin:              { can_access_leads: true,  can_access_invoices: true,  can_access_estimates: false, can_access_blog: false, can_access_cms: false, can_access_seo: false, can_access_team: false, can_access_tracking: false, can_access_field_crew: false },
  estimator:                 { can_access_leads: true,  can_access_invoices: false, can_access_estimates: true,  can_access_blog: false, can_access_cms: false, can_access_seo: false, can_access_team: false, can_access_tracking: false, can_access_field_crew: false },
  field_crew:                { can_access_leads: false, can_access_invoices: false, can_access_estimates: false, can_access_blog: false, can_access_cms: false, can_access_seo: false, can_access_team: false, can_access_tracking: false, can_access_field_crew: false },
  viewer:                    { can_access_leads: true,  can_access_invoices: false, can_access_estimates: false, can_access_blog: false, can_access_cms: false, can_access_seo: false, can_access_team: false, can_access_tracking: false, can_access_field_crew: false },
};

export default function AdminTeam() {
  const [editUser, setEditUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  // The AdminUser entity is RLS-locked (password hashes / reset tokens live
  // there) — all team management goes through the manageAdminUsers function.
  const manage = async (payload) => {
    const res = await base44.functions.invoke("manageAdminUsers", payload);
    if (res.data?.error) throw new Error(res.data.error);
    return res.data;
  };

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => manage({ action: "list" }).then((d) => d.users || []),
  });

  const createMutation = useMutation({
    mutationFn: (data) => manage({ action: "create", data }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); setShowForm(false); setEditUser(null); },
    onError: (err) => alert(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => manage({ action: "update", id, data }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); setShowForm(false); setEditUser(null); },
    onError: (err) => alert(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => manage({ action: "delete", id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (err) => alert(err.message),
  });

  const handleSave = async (form) => {
    if (form.id) {
      updateMutation.mutate({ id: form.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleNew = () => {
    setEditUser({ name: "", email: "", role: "viewer", active: true, ...ROLE_DEFAULTS.viewer });
    setShowForm(true);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Team Access</h1>
          <p className="text-gray-500 text-sm mt-1">Manage who can access the admin dashboard and which features they can use.</p>
        </div>
        <button onClick={handleNew} className="bg-primary text-white font-bold px-4 py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm w-full sm:w-auto justify-center touch-manipulation">
          <Plus className="w-4 h-4" /> Add Team Member
        </button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { role: "admin",                     desc: "Full access to all areas" },
          { role: "project_manager",           desc: "Leads, invoices & estimates" },
          { role: "assistant_project_manager", desc: "Leads & estimating suite" },
          { role: "site_superintendent",       desc: "Estimating suite & field tools" },
          { role: "operations_manager",        desc: "Leads, invoices, estimates & team" },
          { role: "office_admin",              desc: "Leads & invoice inbox" },
          { role: "estimator",                 desc: "Auto-redirected to Estimating Suite" },
          { role: "field_crew",                desc: "Field app: time clock, tasks, receipts" },
          { role: "viewer",                    desc: "Custom permissions only" },
        ].map(({ role, desc }) => (
          <div key={role} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
            <div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
              <div className="text-xs text-gray-500 mt-1">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* User List — cards on mobile, table on desktop */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading...</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-400 mb-4">No team members added yet</div>
            <button onClick={handleNew} className="text-primary font-semibold text-sm hover:underline">Add your first team member →</button>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {users.map(user => (
                <div key={user.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-secondary text-sm">{user.name}</div>
                      <div className="text-xs text-gray-400 break-all">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {!user.password_hash && (
                        <button
                          title="Resend invite"
                          onClick={async () => {
                            const res = await base44.functions.invoke("adminAuth", { action: "invite", userId: user.id });
                            if (res.data?.link) {
                              const copied = window.confirm(`Copy this setup link for ${user.email}:\n\n${res.data.link}\n\nClick OK to copy.`);
                              if (copied) navigator.clipboard.writeText(res.data.link);
                            } else {
                              alert(`Invite email sent to ${user.email}`);
                            }
                          }}
                          className="text-gray-400 hover:text-primary p-2 touch-manipulation"
                        >
                          <Mail className="w-5 h-5" />
                        </button>
                      )}
                      <button onClick={() => { setEditUser({ ...user }); setShowForm(true); }} className="text-gray-400 hover:text-primary p-2 touch-manipulation"><Edit2 className="w-5 h-5" /></button>
                      <button onClick={() => { if (confirm(`Remove ${user.name}?`)) deleteMutation.mutate(user.id); }} className="text-gray-400 hover:text-red-400 p-2 touch-manipulation"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-600"}`}>{ROLE_LABELS[user.role] || user.role}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${user.active !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {user.active !== false ? "Active" : "Inactive"}
                    </span>
                    {PERMISSIONS.filter(p => user[p.key]).map(p => (
                      <span key={p.key} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{p.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <table className="w-full hidden sm:table">
              <thead className="bg-muted border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Member</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Permissions</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-secondary text-sm">{user.name}</div>
                      <div className="text-xs text-gray-400">{user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-600"}`}>{ROLE_LABELS[user.role] || user.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {PERMISSIONS.filter(p => user[p.key]).map(p => (
                          <span key={p.key} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{p.label}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${user.active !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {user.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {!user.password_hash && (
                          <button
                            title="Resend invite email"
                            onClick={async () => {
                              const res = await base44.functions.invoke("adminAuth", { action: "invite", userId: user.id });
                              if (res.data?.link) {
                                const copied = window.confirm(`Email could not be sent automatically.\n\nCopy this setup link to share with ${user.email}:\n\n${res.data.link}\n\nClick OK to copy.`);
                                if (copied) navigator.clipboard.writeText(res.data.link);
                              } else {
                                alert(`Invite email sent to ${user.email}`);
                              }
                            }}
                            className="text-gray-400 hover:text-primary transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => { setEditUser({ ...user }); setShowForm(true); }} className="text-gray-400 hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => { if (confirm(`Remove ${user.name}?`)) deleteMutation.mutate(user.id); }} className="text-gray-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Form Modal */}
      {showForm && editUser && (
        <UserForm
          user={editUser}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function UserForm({ user, onClose, onSave }) {
  const [form, setForm] = useState(user);
  const toggle = (key) => setForm(f => ({ ...f, [key]: !f[key] }));

  const handleRoleChange = (role) => {
    setForm(f => ({ ...f, role, ...ROLE_DEFAULTS[role] }));
  };

  const isEstimator = form.role === "estimator";
  const isFieldCrew = form.role === "field_crew";
  const isAdmin = form.role === "admin";
  const isOfficeRole = ["project_manager", "assistant_project_manager", "site_superintendent", "operations_manager", "office_admin"].includes(form.role);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-secondary">{user.id ? "Edit Team Member" : "Add Team Member"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 touch-manipulation"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Email *</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary" />
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <button key={r} onClick={() => handleRoleChange(r)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors text-left ${
                    form.role === r ? `${ROLE_COLORS[r]} border-transparent` : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                  }`}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            {isEstimator && <p className="text-xs text-blue-500 mt-2">Estimators are automatically redirected to the Estimating Suite on login.</p>}
            {isFieldCrew && <p className="text-xs text-amber-600 mt-2">Field crew work in the crew app at <span className="font-semibold">coenconstruction.com/field</span> — they sign in there with their app login (invite them as an app user from the Base44 dashboard), not the office backend.</p>}
            {isAdmin && <p className="text-xs text-red-500 mt-2">Admins have access to all areas — no permission restrictions.</p>}
          </div>

          {/* Permissions — only meaningful for viewer/estimator */}
          {!isAdmin && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Area Access</label>
              <div className="grid grid-cols-1 gap-2">
                {PERMISSIONS.map(p => {
                  const checked = !!form[p.key];
                  return (
                    <button key={p.key} onClick={() => toggle(p.key)}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-left transition-colors ${
                        checked ? "bg-primary/5 border-primary/30" : "bg-gray-50 border-gray-200"
                      }`}>
                      <div>
                         <span className={`text-sm font-semibold ${checked ? "text-primary" : "text-gray-600"}`}>{p.label}</span>
                         <span className="text-xs text-gray-400 block">{p.desc}</span>
                       </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked ? "bg-primary border-primary" : "border-gray-300 bg-white"
                      }`}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.active !== false} onChange={() => setForm(f => ({ ...f, active: !f.active }))} className="w-4 h-4 accent-primary" />
            <span className="text-sm text-gray-700">Active</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={() => onSave(form)} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
            <Check className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}