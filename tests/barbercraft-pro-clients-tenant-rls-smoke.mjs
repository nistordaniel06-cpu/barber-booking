import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync("supabase/migrations/20261011_fix_bc_pro_clients_tenant_rls.sql", "utf8")
  .split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
assert.match(sql, /alter\s+policy\s+bc_pro_client_read\s+on\s+public\.bc_pro_clients/i);
assert.match(sql, /alter\s+policy\s+bc_pro_client_add\s+on\s+public\.bc_pro_clients/i);
assert.match(sql, /alter\s+policy\s+bc_pro_client_read[\s\S]*?to\s+authenticated[\s\S]*?using\s*\(/i);
assert.match(sql, /alter\s+policy\s+bc_pro_client_add[\s\S]*?to\s+authenticated[\s\S]*?with\s+check\s*\(/i);
assert.equal((sql.match(/m\.salon_id\s*=\s*bc_pro_clients\.salon_id/gi)??[]).length,2,
  "Both client policies must correlate membership with the target client row's salon_id");
assert.doesNotMatch(sql, /m\.salon_id\s*=\s*m\.salon_id/i,
  "Never authorize via a self-comparison that leaks tenants");
assert.match(sql, /m\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
assert.match(sql, /m\.role\s+in\s*\('owner',\s*'admin',\s*'manager'\)/i);
assert.doesNotMatch(sql, /drop\s+policy|drop\s+table|delete\s+from|truncate\s+/i);
console.log("PASS: bc_pro_clients policies use tenant-correlated RLS for SELECT and INSERT");
