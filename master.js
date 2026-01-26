/**
 * MDA Inventory System - Master Controller
 * זהו הקובץ המרכזי השולט על כל האתרים.
 */

// 1. הזרקת CSS (עיצוב) לכל האתרים
const style = document.createElement('style');
style.textContent = `
:root {
    --mda-blue: #003366;
    --mda-red: #cc0000;
    --bg: #f8f9fa;
    --success: #28a745;
}
body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    background: var(--bg);
    margin: 0;
    direction: rtl;
}
.hidden { display: none !important; }
.ticker-wrap { background: #ffc107; color: #000; padding: 10px; font-weight: bold; text-align: center; border-bottom: 2px solid #e0a800; font-size: 1.1em; }
.login-page { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: white; }
.login-card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); width: 320px; text-align: center; border-top: 5px solid var(--mda-red); }
.app-container { max-width: 1000px; margin: 0 auto; padding: 20px; }
header { display: flex; justify-content: space-between; align-items: center; background: var(--mda-blue); color: white; padding: 15px 25px; border-radius: 8px; margin-bottom: 20px; }
.nav-tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.tab-btn { background: #ddd; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
.tab-btn.active { background: var(--mda-red); color: white; }
.item-card { background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-right: 4px solid var(--mda-blue); }
.admin-row { display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px; margin-bottom: 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-wrap: wrap; gap: 10px; }
.btn { border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; }
.btn-save { background: var(--success); color: white; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); padding: 15px 30px; font-size: 1.2em; z-index: 100; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
input, select { padding: 8px; border: 1px solid #ccc; border-radius: 5px; }
table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
th, td { padding: 12px; text-align: center; border-bottom: 1px solid #eee; }
th { background: #f1f1f1; }
`;
document.head.appendChild(style);

// 2. אתחול המערכת וה-Firebase
if (window.SITE_CONFIG) {
    firebase.initializeApp(window.SITE_CONFIG);
} else {
    console.error("SITE_CONFIG missing! Make sure it is defined in Google Sites.");
}
const db = firebase.database();

// משתנים גלובליים
let inv=[], team=[], logs=[], chart, localChanges={};

// פונקציית טעינת לוגו ונתונים ראשונית
window.addEventListener('load', () => {
    if(window.SITE_LOGO && document.getElementById('main-logo')) {
        document.getElementById('main-logo').src = window.SITE_LOGO;
    }
    loadData();
});

// --- פונקציות הליבה של המערכת ---

function loadData() {
    db.ref('inventory').on('value', snap => {
        inv = [];
        snap.forEach(c => { inv.push({id: c.key, ...c.val()}); });
        renderUser();
        if (!window.isRenaming) renderAdmin();
        updateStats();
    });
    
    db.ref('team').on('value', snap => {
        team = [];
        let h = "";
        snap.forEach(c => {
            const t = {id: c.key, ...c.val()};
            team.push(t);
            h += `<tr><td>${t.name}</td><td>${t.phone}</td><td>${t.pin}</td><td><button onclick="if(confirm('למחוק?')) { db.ref('team/${t.id}').remove(); }">❌</button></td></tr>`;
        });
        const teamEl = document.getElementById('team-table');
        if(teamEl) teamEl.innerHTML = h;
    });

    db.ref('logs').orderByChild('timestamp').limitToLast(50).on('value', snap => {
        let h = "";
        snap.forEach(c => {
            const l = c.val();
            const action = l.action || 'take';
            h = `<tr>
                <td style="color:#666;">${l.date || ''}</td>
                <td><span class="user-tag">${l.user || ''}</span></td>
                <td><b>${l.item || ''}</b></td>
                <td style="color:red;">${action === 'take' ? l.amount : ''}</td>
                <td style="color:green;">${action === 'add' ? l.amount : ''}</td>
                <td>${l.qty_after || ''}</td>
                <td><small>${l.reason || '-'}</small></td>
            </tr>` + h;
        });
        const logsEl = document.getElementById('logs-list-body');
        if(logsEl) logsEl.innerHTML = h;
    });
    
    db.ref('settings/ticker').on('value', s => {
        const tick = document.getElementById('ticker');
        if(tick) tick.innerText = s.val() || "";
    });
}

function login(role) {
    const ADMINS={"ofireng@gmail.com":"Ofir","eyaly54@gmail.com":"Eyal","Avihaiyinon@gmail.com":"Avihaiy"};
    const NAMES={"ofireng@gmail.com":"אופיר מנהל","eyaly54@gmail.com":"אייל מנהל","Avihaiyinon@gmail.com":"אביחי מנהל"};

    if (role === 'admin') {
        const e = document.getElementById('a-email').value;
        const p = document.getElementById('a-pass').value;
        if (ADMINS[e] && ADMINS[e] === p) {
            window.curU = NAMES[e];
            showApp('scr-admin');
        } else { alert("פרטי מנהל שגויים"); }
    } else {
        const ph = document.getElementById('u-phone').value;
        const ps = document.getElementById('u-pass').value;
        const m = team.find(t => t.phone == ph && t.pin == ps);
        if (m) {
            window.curU = m.name;
            document.getElementById('u-hello').innerText = "שלום " + m.name;
            showApp('scr-user');
        } else { alert("טלפון או קוד שגויים"); }
    }
}

function showApp(id) {
    document.getElementById('scr-login').classList.add('hidden');
    document.getElementById('app-main').classList.remove('hidden');
    document.querySelectorAll('.scr-child').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'scr-admin') updateStats();
}

function showTab(id, btn) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// פונקציות מלאי משתמש
function renderUser(q = "") {
    const container = document.getElementById('user-stock-list');
    if(!container) return;
    const groups = {};
    inv.forEach(i => {
        if (!groups[i.category]) groups[i.category] = [];
        groups[i.category].push(i);
    });
    container.innerHTML = "";
    Object.keys(groups).sort().forEach(cat => {
        const items = groups[cat].filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
        if (!items.length) return;
        let h = `<div style="background:#eee; padding:5px 10px; font-weight:bold;">${cat}</div>`;
        items.forEach(i => {
            const pVal = localChanges[i.id] || "";
            h += `<div class="item-card">
                <div><b>${i.name}</b> <br> <small>מלאי: ${i.qty}</small></div>
                <input type="number" style="width:60px" value="${pVal}" placeholder="0" oninput="trackChange('${i.id}', this.value)">
            </div>`;
        });
        container.innerHTML += h;
    });
}

function trackChange(id, val) {
    const amt = parseInt(val);
    if (!amt || amt <= 0) delete localChanges[id];
    else localChanges[id] = amt;
    const btn = document.getElementById('floating-save');
    const count = Object.keys(localChanges).length;
    btn.style.display = count > 0 ? 'block' : 'none';
    btn.innerText = `💾 שמור שינויים (${count})`;
}

async function syncAllChanges() {
    const reason = document.getElementById('u-reason').value.trim() || "לקיחת ציוד";
    for (const id in localChanges) {
        const item = inv.find(x => x.id === id);
        if (localChanges[id] > item.qty) {
            alert(`אין מספיק ${item.name} במלאי!`);
            return;
        }
    }
    for (const id in localChanges) {
        const item = inv.find(x => x.id === id);
        const amt = localChanges[id];
        await db.ref('inventory/' + id + '/qty').set(item.qty - amt);
        await db.ref('logs').push({
            user: window.curU, item: item.name, amount: amt, action: 'take',
            qty_before: item.qty, qty_after: item.qty - amt, reason: reason,
            timestamp: Date.now(), date: new Date().toLocaleString('he-IL')
        });
    }
    localChanges = {};
    document.getElementById('floating-save').style.display = 'none';
    alert("עודכן בהצלחה");
}

// ניהול מלאי - אדמין
function renderAdmin(q = "") {
    const container = document.getElementById('admin-list');
    if(!container) return;
    container.innerHTML = "";
    inv.filter(i => i.name.toLowerCase().includes(q.toLowerCase())).forEach(i => {
        const row = document.createElement('div');
        row.className = "admin-row";
        row.innerHTML = `
            <div><b>${i.name}</b> <br> <small>${i.category}</small></div>
            <div>
                <input type="number" id="qty-set-${i.id}" value="${i.qty}" style="width:50px">
                <button onclick="updateQtyDirect('${i.id}', ${i.qty})">עדכן</button>
                <button onclick="if(confirm('למחוק?')) db.ref('inventory/${i.id}').remove()" style="background:none; border:none;">🗑️</button>
            </div>`;
        container.appendChild(row);
    });
}

async function updateQtyDirect(id, oldQty) {
    const newQty = parseInt(document.getElementById(`qty-set-${id}`).value);
    const item = inv.find(i => i.id === id);
    await db.ref('inventory/' + id + '/qty').set(newQty);
    await db.ref('logs').push({
        user: window.curU + " (מנהל)", item: item.name, amount: Math.abs(newQty - oldQty),
        action: newQty > oldQty ? 'add' : 'take', qty_before: oldQty, qty_after: newQty,
        reason: "עדכון מנהל", timestamp: Date.now(), date: new Date().toLocaleString('he-IL')
    });
    alert("עודכן");
}

function addItem() {
    const n = document.getElementById('n-name').value;
    const c = document.getElementById('n-cat').value;
    const q = parseInt(document.getElementById('n-qty').value) || 0;
    if(n && c) db.ref('inventory').push({name: n, category: c, qty: q});
}

function updateStats() {
    const cats = {};
    inv.forEach(i => cats[i.category] = (cats[i.category] || 0) + 1);
    const ctx = document.getElementById('chartPie')?.getContext('2d');
    if (!ctx) return;
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{ data: Object.values(cats), backgroundColor: ['#003366', '#cc0000', '#ffc107', '#28a745'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
