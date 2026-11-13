"use strict";
// Выдать тариф вручную (пока нет онлайн-оплаты): npm run set-plan -- user@mail.com pro
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const [email, plan] = process.argv.slice(2);
if (!email || !["free", "pro"].includes(plan)) { console.error("Использование: npm run set-plan -- <email> <free|pro>"); process.exit(1); }
const db = new DatabaseSync(process.env.DB_FILE || path.join(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "royou.db"));
const r = db.prepare("UPDATE users SET plan=? WHERE email=?").run(plan, email.toLowerCase());
console.log(r.changes ? `Тариф ${email} → ${plan}` : "Пользователь не найден");
