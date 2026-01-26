firebase.initializeApp(window.SITE_CONFIG);

let inv=[], team=[], logs=[], chart, localChanges={};

// Custom modal functions to replace blocked confirm() dialogs
function showCustomModal(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');
        
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.style.display = 'flex';
        
        const handleConfirm = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };
        
        const handleCancel = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

// Enhanced Firebase error handling
function handleFirebaseError(error, fallbackAction) {
    console.warn('Firebase operation failed:', error);
    if (fallbackAction) {
        console.log('Executing fallback action');
        fallbackAction();
    }
}
async function adminAddQuantity(itemId, addAmount, reason = "הוספת ציוד") {
    const item = inv.find(i => i.id === itemId);
    if (!item) return alert("פריט לא נמצא במלאי");
    const qtyBefore = item.qty;
    const qtyAfter = item.qty + addAmount;
    await db.ref('inventory/' + itemId + '/qty').set(qtyAfter);
    await db.ref('logs').push({
        user: window.curU,
        item: item.name,
        amount: addAmount,
        action: 'add',
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        reason: reason,
        timestamp: Date.now(),
        date: new Date().toLocaleString('he-IL')
    });
    alert(`המלאי עודכן: +${addAmount} ל-${item.name}`);
    renderAdmin();
}

// Firebase listeners
function loadData() {
    db.ref('inventory').on('value', snap => {
        inv = [];
        snap.forEach(c => {
            inv.push({id: c.key, ...c.val()});
        });
        renderUser();
        
        // Only re-render admin if we're not in the middle of a rename operation
        if (!window.isRenaming) {
            renderAdmin();
        }
        updateStats();
    });
    
    db.ref('team').on('value', snap => {
        team = [];
        let h = "";
        snap.forEach(c => {
            const t = {id: c.key, ...c.val()};
            team.push(t);
            h += `<tr>
                <td>${t.name}</td>
                <td>${t.phone}</td>
                <td>${t.pin}</td>
                <td>
                    <button onclick="if(confirm('למחוק?')) {
                        db.ref('team/${t.id}').remove();
                    }">❌</button>
                </td>
            </tr>`;
        });
        document.getElementById('team-table').innerHTML = h;
    });

    db.ref('logs').orderByChild('timestamp').on('value', snap => {
        logs = [];
        let h = "";
        snap.forEach(c => {
            const l = c.val();
            logs.push(l);
            const action = l.action || 'take';
            const taken = action === 'take' ? l.amount : '';
            const added = action === 'add' ? l.amount : '';
            // fallback for old logs
            const qtyBefore = l.qty_before ?? '-';
            const qtyAfter = l.qty_after ?? '-';
            h = `<tr>
                <td style="color:#666;font-size:0.9em;">${l.date || ''}</td>
                <td class="user-tag">${l.user || ''}</td>
                <td><b>${l.item || ''}</b></td>
                <td style="color:#cc0000;"><b>${taken}</b></td>
                <td style="color:#28a745;"><b>${added}</b></td>
                <td><b>${qtyBefore}</b></td>
                <td><b>${qtyAfter}</b></td>
                <td style="text-align:right;"><small>${l.reason || '-'}</small></td>
            </tr>` + h;
        });
        document.getElementById('logs-list-body').innerHTML = h;
    });
    
    db.ref('settings/ticker').on('value', s => {
        document.getElementById('ticker').innerText = s.val() || "";
    });
}
loadData();

const ADMINS={"ofireng@gmail.com":"Ofir","eyaly54@gmail.com":"Eyal","Avihaiyinon@gmail.com":"Avihaiy"};
const NAMES={"ofireng@gmail.com":"אופיר מנהל","eyaly54@gmail.com":"אייל מנהל","Avihaiyinon@gmail.com":"אביחי מנהל"};

function login(role) {
    if (role === 'admin') {
        const e = document.getElementById('a-email').value;
        const p = document.getElementById('a-pass').value;
        
        if (ADMINS[e] && ADMINS[e] === p) {
            window.curU = NAMES[e];
            showApp('scr-admin');
        } else {
            // הצגת הודעת שגיאה למנהל
            document.getElementById('err-admin').style.display = 'block';
        }
    } else {
        const ph = document.getElementById('u-phone').value;
        const ps = document.getElementById('u-pass').value;
        const m = team.find(t => t.phone == ph && t.pin == ps);
        
        if (m) {
            window.curU = m.name;
            document.getElementById('u-hello').innerText = "שלום " + m.name;
            showApp('scr-user');
        } else {
            // הצגת הודעת שגיאה למשתמש (מה שהיה חסר)
            document.getElementById('err-user').style.display = 'block';
        }
    }
}

function showApp(id) {
    document.getElementById('scr-login').classList.add('hidden');
    document.getElementById('app-main').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
    
    if (id === 'scr-admin') {
        setTimeout(updateStats, 100);
    }
}

function logout() {
    if (Object.keys(localChanges).length > 0 && !confirm("שינויים לא נשמרו, לצאת?")) {
        return;
    }
    window.location.href = "https://sites.google.com/view/madehod-hasharon";
}

function showTab(id, btn) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if (id === 'tab-dash') {
        updateStats();
    }
    if (id === 'tab-reports') {
        generateReport();
    }
}

function updateStats() {
    document.getElementById('st-total').innerText = inv.length;
    const cats = {};
    inv.forEach(i => cats[i.category] = (cats[i.category] || 0) + 1);
    document.getElementById('st-cats').innerText = Object.keys(cats).length;

    const ctx = document.getElementById('chartPie')?.getContext('2d');
    if (!ctx) return;
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{
                data: Object.values(cats),
                backgroundColor: ['#003366', '#cc0000', '#ffc107', '#28a745', '#17a2b8', '#6c757d']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function generateReport() {
    const days = parseInt(document.getElementById('report-range').value);
    const limit = Date.now() - (days * 24 * 60 * 60 * 1000);
    const summary = {};
    logs.filter(l => l.timestamp > limit).forEach(l => {
        summary[l.item] = (summary[l.item] || 0) + parseInt(l.amount);
    });

    let h = `<table><thead><tr><th>שם מוצר</th><th>סה"כ נלקח</th></tr></thead><tbody>`;
    for (let item in summary) {
        h += `<tr><td>${item}</td><td><b>${summary[item]}</b></td></tr>`;
    }
    h += `</tbody></table>`;
    document.getElementById('report-results').innerHTML = Object.keys(summary).length ? h : "אין נתונים לתקופה זו";
}

function renderUser(q = "") {
    const container = document.getElementById('user-stock-list');
    const groups = {};
    
    inv.forEach(i => {
        if (!groups[i.category]) {
            groups[i.category] = [];
        }
        groups[i.category].push(i);
    });

    container.innerHTML = "";
    Object.keys(groups).sort().forEach(cat => {
        const items = groups[cat].filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
        
        if (!items.length) {
            return;
        }

        let h = `<div class="cat-title">${cat}</div>`;
        items.forEach(i => {
            const pVal = localChanges[i.id] || "";
            h += `<div class="item-card">
                <div><span class="item-name">${i.name}</span><span class="item-stock">במלאי: ${i.qty}</span></div>
                <input type="number" class="quick-input ${pVal ? 'changed' : ''}" value="${pVal}" placeholder="0" oninput="trackChange('${i.id}', this.value)">
            </div>`;
        });
        container.innerHTML += h;
    });
}

function trackChange(id, val) {
    const amt = parseInt(val);
    
    if (!amt || amt <= 0) {
        delete localChanges[id];
    } else {
        localChanges[id] = amt;
    }

    const count = Object.keys(localChanges).length;
    const btn = document.getElementById('floating-save');
    
    if (count > 0) {
        btn.style.display = 'block';
        btn.innerText = `💾 שמור שינויים (${count})`;
    } else {
        btn.style.display = 'none';
    }
}

async function syncAllChanges() {
    const reason = document.getElementById('u-reason').value.trim() || "לא צוינה סיבה";

    // Validation: make sure user isn't taking more than in stock
    for (const id in localChanges) {
        const item = inv.find(x => x.id === id);
        if (localChanges[id] > item.qty) {
            alert(`שגיאה: ניסית לקחת ${localChanges[id]} מתוך ${item.name}, אבל יש רק ${item.qty} במלאי.`);
            return;
        }
    }

    const btn = document.getElementById('floating-save');
    btn.innerText = "מעדכן...";
    btn.disabled = true;

    for (const id in localChanges) {
        const item = inv.find(x => x.id === id);
        const amt = localChanges[id];
        // Update inventory quantity
        await db.ref('inventory/' + id + '/qty').set(item.qty - amt);
        // Push log entry
        await db.ref('logs').push({
            user: window.curU,
            item: item.name,
            amount: amt,
            action: 'take',           // mark as take
            qty_before: item.qty,     // quantity before
            qty_after: item.qty - amt,// quantity after
            reason: reason,
            timestamp: Date.now(),
            date: new Date().toLocaleString('he-IL')
        });
    }

    // Clear changes and reset UI
    localChanges = {};
    document.getElementById('u-reason').value = "";
    btn.style.display = 'none';
    btn.disabled = false;

    alert("המלאי עודכן בהצלחה!");
    renderUser();
}

// -------------------- Admin / Inventory Functions --------------------

// Render admin inventory list
function renderAdmin(q = "") {
    const container = document.getElementById('admin-list');
    container.innerHTML = "";

    inv
    .filter(i => i.name.toLowerCase().includes(q.toLowerCase()))
    .forEach(i => {
        const row = document.createElement('div');
        row.className = "admin-row";

        row.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:5px;">
                <input type="text" id="rename-${i.id}" value="${i.name}"
                    style="font-weight:bold; font-size:1em; padding:6px; border-radius:6px; border:1px solid #ccc;">
                <small style="color:#666;">קטגוריה: ${i.category}</small>
            </div>

            <div style="display:flex; align-items:center; gap:10px;">
                <button class="btn btn-rename">שנה שם</button>
                <input type="number" value="${i.qty}" style="width:65px;">
                <input type="number" placeholder="+ הוסף" id="add-${i.id}" style="width:65px;">
                <input type="text" placeholder="סיבת הוספה" id="add-reason-${i.id}" style="width:120px;">
                <button class="btn" style="background:#28a745; color:white; padding:6px 10px;">➕</button>
                <button class="btn-delete-item">🗑️</button>
            </div>
        `;

        container.appendChild(row);

        // ----- Rename button -----
        const renameBtn = row.querySelector('.btn-rename');
        renameBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const inputEl = document.getElementById(`rename-${i.id}`);
            const newName = inputEl.value.trim();

            if (!newName) {
                alert("שם מוצר לא יכול להיות ריק");
                inputEl.value = i.name;
                return;
            }
            
            if (newName === i.name) {
                return;
            }

            const confirmed = await showCustomModal(
                'אישור שינוי שם',
                `לשנות שם מ־"${i.name}" ל־"${newName}"?`
            );
            
            if (!confirmed) {
                inputEl.value = i.name;
                return;
            }

            window.isRenaming = true;
            
            try {
                await db.ref('inventory/' + i.id + '/name').set(newName);
                
                const itemIndex = inv.findIndex(it => it.id === i.id);
                if (itemIndex !== -1) {
                    inv[itemIndex].name = newName;
                }
                
                inputEl.value = newName;
                alert('שם המוצר עודכן בהצלחה!');
                
            } catch (err) {
                handleFirebaseError(err, () => {
                    const itemIndex = inv.findIndex(it => it.id === i.id);
                    if (itemIndex !== -1) {
                        inv[itemIndex].name = newName;
                    }
                    inputEl.value = newName;
                    alert('שם המוצר עודכן מקומית (Firebase לא זמין)');
                });
            } finally {
                window.isRenaming = false;
                renderAdmin();
            }
        });

        // ----- Delete button -----
        const deleteBtn = row.querySelector('.btn-delete-item');
        deleteBtn.addEventListener('click', () => {
            if (confirm(`למחוק את ${i.name}?`)) {
                db.ref('inventory/' + i.id).remove();
            }
        });

        // ----- Update quantity (overwrite) -----
        const qtyInput = row.querySelector('input[type=number]:not([id])');
      
        qtyInput.addEventListener('change', async () => {
            const newQty = parseInt(qtyInput.value);
            
            if (isNaN(newQty)) {
                return;
            }
            
            const qtyBefore = i.qty;
            
            if (newQty === qtyBefore) {
                return;
            }
            
            const confirmed = await showCustomModal(
                'אישור שינוי כמות',
                `לשנות כמות של "${i.name}" מ־${qtyBefore} ל־${newQty}?`
            );
            
            if (!confirmed) {
                qtyInput.value = qtyBefore;
                return;
            }
            
            const diff = newQty - qtyBefore;
            const action = diff > 0 ? 'add' : 'take';
            const amount = Math.abs(diff);
            
            // עדכון מלאי
            await db.ref('inventory/' + i.id + '/qty').set(newQty);
            
            // לוג (add / take רגיל!)
            await db.ref('logs').push({
                user: window.curU,
                item: i.name,
                amount: amount,
                action: action,              // add או take
                qty_before: qtyBefore,
                qty_after: newQty,
                reason: 'שינוי כמות',
                timestamp: Date.now(),
                date: new Date().toLocaleString('he-IL')
            });
            alert('הכמות עודכנה ונרשמה בלוגים');
        });
        
        // ----- Admin add quantity button -----
        const addInput = row.querySelector(`#add-${i.id}`);
        const addBtn = row.querySelector('button[style*="#28a745"]');
        
        // Inside the green add button click event
        addBtn.addEventListener('click', () => {
            const addAmt = parseInt(addInput.value);
            
            if (!addAmt || addAmt <= 0) {
                return alert("נא להזין כמות חוקית להוספה");
            }
            
            const reasonInput = document.getElementById(`add-reason-${i.id}`);
            const reason = reasonInput.value.trim() || "הוספת ציוד";
            adminAddQuantity(i.id, addAmt, reason); // pass reason to the function
            addInput.value = "";
            reasonInput.value = "";
        });
    });
}


// Add new item
function addItem() {
    const n = document.getElementById('n-name').value.trim();
    const c = document.getElementById('n-cat').value.trim();
    const q = parseInt(document.getElementById('n-qty').value) || 0;

    if (!n || !c) {
        return alert("נא למלא שם מוצר וקטגוריה");
    }

    db.ref('inventory').push({name: n, category: c, qty: q});
    document.getElementById('n-name').value = "";
    document.getElementById('n-cat').value = "";
    document.getElementById('n-qty').value = "";
    renderAdmin();
}

// Delete all inventory
function deleteAllInventory() {
    if (confirm("🚨 אזהרה! הפעולה תמחק את כל המוצרים במערכת לצמיתות. האם אתה בטוח?")) {
        if (confirm("אישור סופי למחיקת כל המלאי?")) {
            db.ref('inventory').remove();
            alert("כל המלאי נמחק בהצלחה.");
        }
    }
}

// Upload CSV inventory
function uploadInv() {
    const file = document.getElementById('csv-upload').files[0];
    
    if (!file) {
        return alert("בחר קובץ");
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const lines = e.target.result.split('\n');
        lines.slice(1).forEach(l => {
            const parts = l.split(',');
            
            if (parts.length >= 2) {
                const n = parts[0].trim();
                const c = parts[1].trim();
                const q = parseInt(parts[2]) || 0;
                
                if (n && c) {
                    const ex = inv.find(i => i.name.trim() === n);
                    
                    if (ex) {
                        db.ref('inventory/' + ex.id).update({qty: q});
                    } else {
                        db.ref('inventory').push({name: n, category: c, qty: q});
                    }
                }
            }
        });
        alert("הקובץ נטען והמלאי עודכן.");
    };
    reader.readAsText(file);
}

// Download CSV inventory
function downloadInv() {
    let csv = "\uFEFFשם,קטגוריה,כמות\n";
    inv.forEach(i => csv += `${i.name},${i.category},${i.qty}\n`);
    
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'inventory_mda.csv';
    a.click();
}

// Download logs CSV
const csvSafe = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

function downloadLogs() {
    let csv = "\uFEFFתאריך,משתמש,מוצר,נלקח,התווסף,מלאי אחרי,סיבה\n";

    logs.forEach(l => {
        const action = l.action || 'take';
        csv += [
            csvSafe(l.date),
            csvSafe(l.user),
            csvSafe(l.item),
            csvSafe(action === 'take' ? l.amount : ''),
            csvSafe(action === 'add' ? l.amount : ''),
            csvSafe(l.qty_after),
            csvSafe(l.reason)
        ].join(',') + '\n';
    });
    
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'logs_mda_detailed.csv';
    a.click();
}

// Add new team member
function addTeam() {
    const n = document.getElementById('t-name').value.trim();
    const p = document.getElementById('t-phone').value.trim();
    const pi = document.getElementById('t-pin').value.trim();
    
    if (!n || !p || !pi) {
        return alert("נא למלא שם, טלפון וקוד אישי");
    }
    
    db.ref('team').push({name: n, phone: p, pin: pi});
    document.getElementById('t-name').value = "";
    document.getElementById('t-phone').value = "";
    document.getElementById('t-pin').value = "";
}

</script>
