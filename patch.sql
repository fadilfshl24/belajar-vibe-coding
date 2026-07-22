INSERT INTO "role_menu_permissions" ("role_id", "menu_id", "can_view", "can_create", "can_update", "can_delete", "can_access_api")
SELECT r.id, m.id, true, true, true, true, true
FROM "roles" r, "menus" m
WHERE r.code IN ('superadmin', 'admin', 'manager', 'warehouse_head', 'branch_head')
AND m.code IN ('quotation_plan', 'hpp_report')
ON CONFLICT DO NOTHING;
