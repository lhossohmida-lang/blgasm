"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { db } from "@/lib/firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { registerWithEmail } from "@/lib/firebase/auth";
import { useStore } from "@/components/providers/store-provider";
import { UserRound, Plus, Shield, ShieldCheck, ShieldAlert, Trash2, Loader2 } from "lucide-react";

type UserRole = "admin" | "employee" | "accountant";

interface StoreUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

const roleLabels: Record<UserRole, string> = {
  admin: "مدير",
  employee: "موظف",
  accountant: "محاسب",
};

const roleIcons: Record<UserRole, typeof Shield> = {
  admin: ShieldCheck,
  employee: UserRound,
  accountant: ShieldAlert,
};

const roleColors: Record<UserRole, string> = {
  admin: "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300",
  employee: "text-leaf-700 bg-leaf-50 dark:bg-leaf-900/20 dark:text-leaf-300",
  accountant: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300",
};

export default function UsersPage() {
  const { user } = useAuth();
  const { data } = useStore();
  const { notify } = useToast();

  const [users, setUsers] = useState<StoreUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("employee");
  const [creating, setCreating] = useState(false);

  const storeId = data?.store.id;

  useEffect(() => {
    if (!storeId) return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  async function loadUsers() {
    if (!storeId) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "users"), where("storeId", "==", storeId))
      );
      setUsers(snap.docs.map((d) => d.data() as StoreUser));
    } catch (err) {
      notify({ tone: "error", title: "تعذر تحميل المستخدمين", body: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(uid: string, role: UserRole) {
    setSaving(uid);
    try {
      await updateDoc(doc(db, "users", uid), { role, updatedAt: new Date().toISOString() });
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)));
      notify({ tone: "success", title: "تم تحديث الدور" });
    } catch (err) {
      notify({ tone: "error", title: "فشل تحديث الدور", body: String(err) });
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(uid: string, isActive: boolean) {
    setSaving(uid);
    try {
      await updateDoc(doc(db, "users", uid), { isActive: !isActive, updatedAt: new Date().toISOString() });
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, isActive: !isActive } : u)));
      notify({ tone: "info", title: !isActive ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم" });
    } catch (err) {
      notify({ tone: "error", title: "فشل تغيير الحالة", body: String(err) });
    } finally {
      setSaving(null);
    }
  }

  async function createUser() {
    if (!storeId || !newEmail || !newPassword || !newName) {
      notify({ tone: "warning", title: "يرجى ملء جميع الحقول" });
      return;
    }
    setCreating(true);
    try {
      const credential = await registerWithEmail(newEmail, newPassword);
      const newUser: StoreUser = {
        uid: credential.user.uid,
        email: newEmail,
        displayName: newName,
        role: newRole,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "users", credential.user.uid), {
        ...newUser,
        storeId,
        updatedAt: new Date().toISOString(),
      });
      setUsers((prev) => [...prev, newUser]);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setShowForm(false);
      notify({ tone: "success", title: "تم إنشاء المستخدم بنجاح", body: newEmail });
    } catch (err) {
      notify({ tone: "error", title: "فشل إنشاء المستخدم", body: String(err) });
    } finally {
      setCreating(false);
    }
  }

  // Only admin can access this page
  if (!user || user.isDemo) {
    return (
      <div className="ios-page">
        <div className="ios-card text-center py-12">
          <Shield className="h-12 w-12 mx-auto text-market-ink/30 mb-3" />
          <p className="font-bold text-market-ink/50 dark:text-white/40">
            هذه الصفحة للمديرين فقط
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ios-page">
      <div className="ios-topbar">
        <div className="ios-icon">
          <UserRound className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black">إدارة المستخدمين</h1>
          <p className="text-sm text-market-ink/60 dark:text-white/50 mt-0.5">
            {users.length} مستخدم في المتجر
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="ios-circle-button"
          title="مستخدم جديد"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* New user form */}
      {showForm && (
        <div className="ios-card mb-5 border-leaf-200/60">
          <h2 className="text-lg font-black mb-4">إضافة مستخدم جديد</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="الاسم الكامل"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="ios-input w-full"
            />
            <input
              type="email"
              placeholder="البريد الإلكتروني"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="ios-input w-full"
              dir="ltr"
            />
            <input
              type="password"
              placeholder="كلمة المرور (8 أحرف على الأقل)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="ios-input w-full"
              dir="ltr"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="ios-input w-full"
            >
              <option value="employee">موظف — إضافة مبيعات ومنتجات</option>
              <option value="accountant">محاسب — قراءة التقارير فقط</option>
              <option value="admin">مدير — صلاحيات كاملة</option>
            </select>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={createUser}
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-leaf-600 px-4 py-3 text-sm font-black text-white hover:bg-leaf-700 disabled:opacity-50 transition"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                إنشاء الحساب
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-2xl bg-black/5 dark:bg-white/10 px-4 py-3 text-sm font-black hover:bg-black/10 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="ios-card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-leaf-600" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-12 text-center text-sm font-bold text-market-ink/40 dark:text-white/30">
            لا يوجد مستخدمون بعد
          </p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {users.map((u) => {
              const RoleIcon = roleIcons[u.role] ?? UserRound;
              const isSelf = u.uid === user.uid;
              const isBusy = saving === u.uid;
              return (
                <div key={u.uid} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="ios-icon h-12 w-12 rounded-2xl shrink-0">
                    <RoleIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black truncate">
                      {u.displayName || u.email}
                    </p>
                    <p className="text-xs text-market-ink/50 dark:text-white/40 truncate" dir="ltr">
                      {u.email}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black ${roleColors[u.role]}`}>
                        <RoleIcon className="h-3 w-3" />
                        {roleLabels[u.role]}
                      </span>
                      {!u.isActive && (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-black text-red-600 dark:bg-red-900/20 dark:text-red-300">
                          معطّل
                        </span>
                      )}
                      {isSelf && (
                        <span className="inline-flex items-center rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-xs font-bold text-market-ink/50 dark:text-white/40">
                          أنت
                        </span>
                      )}
                    </div>
                  </div>
                  {!isSelf && (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role selector */}
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.uid, e.target.value as UserRole)}
                        disabled={isBusy}
                        className="text-xs font-bold rounded-xl border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 disabled:opacity-50"
                      >
                        <option value="employee">موظف</option>
                        <option value="accountant">محاسب</option>
                        <option value="admin">مدير</option>
                      </select>
                      {/* Toggle active */}
                      <button
                        type="button"
                        onClick={() => toggleActive(u.uid, u.isActive)}
                        disabled={isBusy}
                        title={u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                        className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition disabled:opacity-50 ${
                          u.isActive
                            ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
                            : "bg-leaf-50 text-leaf-700 hover:bg-leaf-100 dark:bg-leaf-900/20 dark:text-leaf-300"
                        }`}
                      >
                        {isBusy
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                        {u.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role permissions table */}
      <div className="ios-card mt-5">
        <h2 className="text-lg font-black mb-4">صلاحيات الأدوار</h2>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/10">
                <th className="text-right pb-3 font-black text-market-ink/60 dark:text-white/50">الصلاحية</th>
                <th className="pb-3 text-center font-black text-red-600">مدير</th>
                <th className="pb-3 text-center font-black text-leaf-700">موظف</th>
                <th className="pb-3 text-center font-black text-blue-600">محاسب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {[
                ["إضافة مبيعات", true, true, false],
                ["إضافة / تعديل منتجات", true, true, false],
                ["حذف منتجات", true, false, false],
                ["حذف مبيعات", true, false, false],
                ["إدارة عملاء الكريدي", true, true, false],
                ["عرض التقارير", true, false, true],
                ["إدارة المستخدمين", true, false, false],
                ["تعديل إعدادات المتجر", true, false, true],
              ].map(([label, admin, employee, accountant]) => (
                <tr key={String(label)}>
                  <td className="py-2.5 font-semibold text-market-ink/80 dark:text-white/70">{String(label)}</td>
                  <td className="py-2.5 text-center">{admin ? "✅" : "❌"}</td>
                  <td className="py-2.5 text-center">{employee ? "✅" : "❌"}</td>
                  <td className="py-2.5 text-center">{accountant ? "✅" : "❌"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
