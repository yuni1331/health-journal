        // ================================================================
        //  工具函数
        // ================================================================
        // 立即设置日期标签（中文格式）
        (function(){
            try {
                var d = new Date();
                var pad = function(n){ return n < 10 ? '0'+n : ''+n; };
                var ds = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
                var DAYS_CN = ['日','一','二','三','四','五','六'];
                var day = d.getDay();
                var formatted = d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日 周' + DAYS_CN[day];
                var el = document.getElementById('dateLabel');
                if (el) el.textContent = formatted;
                window._todayStr = ds;
                // 立即渲染周日历条
                var strip = document.getElementById('weekStrip');
                if (strip) {
                    // 计算本周一
                    var diff = (day === 0 ? 6 : day - 1);
                    var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
                    var html = '';
                    var NAMES = ['一','二','三','四','五','六','日'];
                    for (var i = 0; i < 7; i++) {
                        var dd = new Date(monday);
                        dd.setDate(monday.getDate() + i);
                        var dStr = dd.getFullYear() + '-' + pad(dd.getMonth()+1) + '-' + pad(dd.getDate());
                        var isToday = dStr === ds;
                        var isActive = isToday; // 初始就是今天
                        var isFuture = dStr > ds;
                        var cls = 'day-cell';
                        if (isToday) cls += ' today';
                        if (isActive) cls += ' active';
                        if (isFuture) cls += ' future';
                        var onclick = isFuture ? '' : ' onclick="goToDate(\'' + dStr + '\')"';
                        html += '<div class="' + cls + '"' + onclick + '>' +
                                '<span class="day-name">' + NAMES[i] + '</span>' +
                                '<span class="day-num">' + dd.getDate() + '</span>' +
                                '<span class="data-dot"></span>' +
                                '</div>';
                    }
                    strip.innerHTML = html;
                }
            } catch(e) { console.error('init date:', e); }
        })();
        // 兜底函数，确保 onclick 事件可用
        window.resetProfile = function() { document.getElementById('onboardingOverlay').classList.remove('hidden'); };
        window.selectIdentity = function(id) {
            if (id === 'wellness') {
                document.getElementById('medDialog').classList.remove('hidden');
            } else if (window.setProfileAndFinish) {
                window.setProfileAndFinish(id, false);
            }
        };
        window.setProfileAndFinish = async function(identity, trackMed) {
            try {
                document.getElementById('medDialog').classList.add('hidden');
                _profileCache = {identity: identity, trackMedication: trackMed};
                try { localStorage.setItem('health_daily_profile', JSON.stringify(_profileCache)); } catch(e){}
                document.getElementById('onboardingOverlay').classList.add('hidden');
                var badge = document.getElementById('profileBadge');
                var text = document.getElementById('profileBadgeText');
                if (badge) badge.classList.remove('hidden');
                if (text) text.textContent = identity === 'wellness' ? '🌿 养生党' : '💼 上班族';
                // 切换板块可见性
                var mc = document.getElementById('medCard');
                var wc = document.getElementById('waterCard');
                if (mc) { if (identity === 'wellness' && trackMed) mc.classList.add('visible'); else mc.classList.remove('visible'); }
                if (wc) { if (identity === 'office') wc.classList.add('visible'); else wc.classList.remove('visible'); }
            } catch(e) { console.error('setProfileAndFinish (fallback):', e); }
        };
        const DAYS = ['日', '一', '二', '三', '四', '五', '六'];
        const MEALS = ['breakfast', 'lunch', 'dinner'];
        const MEAL_NAMES = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
        const EXERCISE_TYPES = ['散步', '普拉提', '八段锦', '跑步', '其他'];
        const MAX_SESSIONS = 3;

        function pad2(n) { return String(n).padStart(2, '0'); }

        function todayStr() {
            const d = new Date();
            return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        }
        function getTodayDateStr() { return todayStr(); }

        function formatDateCN(dateStr) {
            const [y, m, d] = dateStr.split('-');
            const day = new Date(+y, +m - 1, +d).getDay();
            return `${y}年${+m}月${+d}日 周${DAYS[day]}`;
        }

        function getMonday(dateStr) {
            const d = new Date(dateStr + 'T00:00:00');
            const day = d.getDay();
            const diff = (day === 0 ? 6 : day - 1);
            d.setDate(d.getDate() - diff);
            return d;
        }

        function formatWeekLabel(monDate) {
            const end = new Date(monDate);
            end.setDate(end.getDate() + 6);
            const m1 = monDate.getMonth() + 1,
                d1 = monDate.getDate();
            const m2 = end.getMonth() + 1,
                d2 = end.getDate();
            if (m1 === m2) return `${monDate.getFullYear()}年${m1}月${d1}日 - ${d2}日`;
            return `${monDate.getFullYear()}年${m1}月${d1}日 - ${m2}月${d2}日`;
        }

        function dateStr(d) {
            return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        }

        function getWeekDates(monDate) {
            const dates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(monDate);
                d.setDate(d.getDate() + i);
                dates.push(dateStr(d));
            }
            return dates;
        }

        // ================================================================
        //  当前查看的日期（可切换）
        // ================================================================
        let currentViewDate = todayStr();

        // ================================================================
        //  数据读写 (IndexedDB + 内存缓存)
        // ================================================================
        const DB_NAME = 'healthJournalDB';
        const STORE_NAME = 'healthStore';
        let _dataCache = {};
        let _profileCache = null;
        let _dbReady = false;
        let _db = null;

        function idbOpen() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                };
                req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
                req.onerror = (e) => reject(e.target.error);
            });
        }

        function idbGet(key) {
            return new Promise((resolve) => {
                if (!_db) { resolve(null); return; }
                try {
                    const tx = _db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(key);
                    req.onsuccess = () => resolve(req.result ?? null);
                    req.onerror = () => resolve(null);
                } catch(e) { resolve(null); }
            });
        }

        function idbSet(key, data) {
            return new Promise((resolve) => {
                if (!_db) { resolve(false); return; }
                try {
                    const tx = _db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.put(data, key);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                } catch(e) { resolve(false); }
            });
        }

        async function migrateFromLocalStorage() {
            const oldData = localStorage.getItem('health_daily_data');
            const oldProfile = localStorage.getItem('health_daily_profile');
            let migrated = false;
            if (oldData) {
                try {
                    const data = JSON.parse(oldData);
                    const existing = await idbGet('data');
                    if (!existing || Object.keys(existing).length === 0) {
                        await idbSet('data', data);
                        _dataCache = data;
                        localStorage.removeItem('health_daily_data');
                        migrated = true;
                    }
                } catch(e) {}
            }
            if (oldProfile) {
                try {
                    const profile = JSON.parse(oldProfile);
                    const existing = await idbGet('profile');
                    if (!existing) {
                        await idbSet('profile', profile);
                        _profileCache = profile;
                        localStorage.removeItem('health_daily_profile');
                    }
                } catch(e) {}
            }
            return migrated;
        }

        async function initStorage() {
            try {
                await idbOpen();
                const migrated = await migrateFromLocalStorage();
                if (_dataCache === undefined || Object.keys(_dataCache).length === 0) {
                    const stored = await idbGet('data');
                    if (stored && typeof stored === 'object' && !Array.isArray(stored)) _dataCache = stored;
                }
                if (_profileCache === null) {
                    const p = await idbGet('profile');
                    if (p) _profileCache = p;
                }
                _dbReady = true;
                if (migrated) {
                    setTimeout(() => {
                        const toast = document.getElementById('saveToast');
                        if (toast) { toast.textContent = '✅ 数据已迁移到新存储，更稳定更安全！'; toast.classList.add('show');
                        setTimeout(() => { toast.textContent = '✅ 已保存！'; toast.classList.remove('show'); }, 3000); }
                    }, 800);
                }
            } catch(e) {
                console.warn('IndexedDB 不可用，回退到 localStorage');
                const oldData = localStorage.getItem('health_daily_data');
                if (oldData) { try { _dataCache = JSON.parse(oldData); } catch(e2) {} }
                const oldProfile = localStorage.getItem('health_daily_profile');
                if (oldProfile) { try { _profileCache = JSON.parse(oldProfile); } catch(e2) {} }
                _dbReady = false;
            }
            renderStorageInfo();
        }

        function getData() { return _dataCache; }

        async function setData(data) {
            _dataCache = data;
            if (_dbReady) {
                const ok = await idbSet('data', data);
                if (!ok) {
                    try { localStorage.setItem('health_daily_backup', JSON.stringify(data)); } catch(e) {}
                }
            } else {
                try { localStorage.setItem('health_daily_data', JSON.stringify(data)); } catch(e) {}
            }
            renderStorageInfo();
        }

        function getDayData(dateStr) { return _dataCache[dateStr] || null; }

        async function saveDayData(dateStr, record) {
            _dataCache[dateStr] = record;
            await setData(_dataCache);
        }

        function renderStorageInfo() {
            const el = document.getElementById('storageInfo');
            if (!el) return;
            const count = Object.keys(_dataCache).length;
            const raw = JSON.stringify(_dataCache);
            const kb = (new Blob([raw]).size / 1024).toFixed(1);
            const pct = _dbReady ? '' : ' (备)';
            el.textContent = '📦 已记录 ' + count + ' 天 · ' + kb + ' KB' + pct;
        }

        // ---- 用户配置 ----
        function getProfile() { return _profileCache; }

        async function setProfile(profile) {
            _profileCache = profile;
            if (_dbReady) await idbSet('profile', profile);
            else try { localStorage.setItem('health_daily_profile', JSON.stringify(profile)); } catch(e) {}
        }

        function hasProfile() { return _profileCache !== null; }

        function isWellness() { return _profileCache && _profileCache.identity === 'wellness'; }

        function shouldTrackMedication() { return _profileCache && _profileCache.identity === 'wellness' && _profileCache.trackMedication === true; }

        // ================================================================
        //  睡眠时长计算
        // ================================================================
        function calcSleepDuration() {
            const bed = document.getElementById('sleepBedtime').value;
            const wake = document.getElementById('sleepWakeTime').value;
            const display = document.getElementById('sleepDurationDisplay');
            if (!bed || !wake) {
                display.textContent = '总时长：--';
                return;
            }
            const [bh, bm] = bed.split(':').map(Number);
            const [wh, wm] = wake.split(':').map(Number);
            let totalMin = (wh * 60 + wm) - (bh * 60 + bm);
            if (totalMin < 0) totalMin += 24 * 60;
            const hrs = Math.floor(totalMin / 60);
            const mins = totalMin % 60;
            if (totalMin < 60) { display.textContent = mins + 'm'; }
            else { display.textContent = hrs + 'h' + (mins > 0 ? ' ' + mins + 'm' : ''); }
        }

        function updateDeepSleepValue() {
            var v = document.getElementById('deepSleepSlider').value;
            document.getElementById('deepSleepValue').textContent = v + '%';
        }

        // 睡后感受选择器
        function selectSleepFeeling(chip) {
            const chips = document.querySelectorAll('.feel-chip');
            chips.forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
        }
        function getSleepFeeling() {
            const sel = document.querySelector('.feel-chip.selected');
            return sel ? sel.dataset.feel : '';
        }
        function setSleepFeeling(feel) {
            // 旧数据兼容映射
            const compat = { energetic: 'clear', normal: 'heavy', tired: 'drowsy', exhausted: 'burnout' };
            const mapped = compat[feel] || feel;
            document.querySelectorAll('.feel-chip').forEach(c => {
                c.classList.toggle('selected', c.dataset.feel === mapped);
            });
        }

        // ================================================================
        //  饮食切换
        // ================================================================
        function toggleMeal(meal) {
            const toggle = document.getElementById(meal + 'Toggle');
            const content = document.getElementById(meal + 'Content');
            const feeling = document.getElementById(meal + 'Feeling');
            const isAte = toggle.textContent.includes('✅');
            if (isAte) {
                toggle.textContent = '❌ 没吃';
                toggle.classList.remove('active');
                content.disabled = true;
                content.value = '';
                feeling.disabled = true;
                feeling.value = '';
            } else {
                toggle.textContent = '✅ 吃了';
                toggle.classList.add('active');
                content.disabled = false;
                feeling.disabled = false;
                content.focus();
            }
        }

        // ================================================================
        //  运动分次记录
        // ================================================================
        let sessionCount = 0;

        function createSessionHTML(index, selectedType, durationVal) {
            const opts = EXERCISE_TYPES.map(t =>
                `<option value="${t}" ${selectedType === t ? 'selected' : ''}>${t}</option>`
            ).join('');
            const dur = durationVal != null ? durationVal : '';
            return `
                <div class="ex-session" data-index="${index}">
                    <span class="session-label">第${index + 1}次</span>
                    <select>${opts}</select>
                    <input type="number" min="0" max="600" step="5" placeholder="时长" value="${dur}">
                    <span style="font-size:13px;color:#aaa;">分钟</span>
                    ${index >= 1 ? `<button class="close-btn" onclick="removeSession(this)" title="删除">✕</button>` : ''}
                </div>
            `;
        }

        function renderExerciseSessions(sessions) {
            const container = document.getElementById('exerciseSessions');
            const data = sessions || [{ type: '散步', duration: null }];
            sessionCount = data.length;
            container.innerHTML = data.map((s, i) => createSessionHTML(i, s.type, s.duration)).join('');
            updateAddBtn();
        }

        function addExerciseSession() {
            if (sessionCount >= MAX_SESSIONS) return;
            const container = document.getElementById('exerciseSessions');
            container.insertAdjacentHTML('beforeend', createSessionHTML(sessionCount, '散步', null));
            sessionCount++;
            updateAddBtn();
        }

        function removeSession(btn) {
            const row = btn.closest('.ex-session');
            row.remove();
            sessionCount--;
            // 重新编号
            const container = document.getElementById('exerciseSessions');
            const rows = container.querySelectorAll('.ex-session');
            rows.forEach((r, i) => {
                r.dataset.index = i;
                r.querySelector('.session-label').textContent = `第${i + 1}次`;
                const closeBtn = r.querySelector('.close-btn');
                if (i === 0 && closeBtn) closeBtn.remove();
                else if (i > 0 && !closeBtn) {
                    const x = document.createElement('button');
                    x.className = 'close-btn';
                    x.textContent = '✕';
                    x.onclick = function() { removeSession(this); };
                    r.appendChild(x);
                }
            });
            updateAddBtn();
        }

        function updateAddBtn() {
            document.getElementById('exAddBtn').disabled = sessionCount >= MAX_SESSIONS;
        }

        function collectExerciseSessions() {
            const sessions = [];
            document.querySelectorAll('.ex-session').forEach(row => {
                const type = row.querySelector('select').value;
                const durInput = row.querySelector('input[type="number"]');
                const dur = durInput.value !== '' ? +durInput.value : null;
                sessions.push({ type, duration: dur });
            });
            return sessions;
        }

        // ================================================================
        //  Tab 切换
        // ================================================================
        let currentTab = 'daily';

        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
            document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + tab));
            if (tab === 'weekly') {
                renderWeekly();
            }
        }

        // ================================================================
        //  加载指定日期数据到表单 + 导航函数
        // ================================================================
        function loadDate(dateStr) {
            currentViewDate = dateStr;
            const dayData = getDayData(dateStr);
            const isToday = (dateStr === todayStr());

            // 更新日期标签
            document.getElementById('dateLabel').textContent = formatDateCN(dateStr);

            // 更新后一天按钮
            document.getElementById('nextDayBtn').disabled = isToday;

            // 更新"回到今天"按钮
            const todayBtn = document.getElementById('todayBtn');
            if (isToday) {
                todayBtn.classList.add('hidden');
            } else {
                todayBtn.classList.remove('hidden');
            }

            // 更新保存按钮文案
            document.getElementById('saveBtn').textContent = isToday ? '💾 保存今日记录' : '💾 保存该日记录';

            // 渲染周日历条
            renderWeekStrip(dateStr);

            // 重置睡眠
            document.getElementById('sleepBedtime').value = '';
            document.getElementById('sleepWakeTime').value = '';
            document.getElementById('deepSleepSlider').value = 15;
            updateDeepSleepValue();
            document.getElementById('awakeCount').value = '0';
            document.getElementById('sleepNotes').value = '';
            document.getElementById('napMinutes').value = '';
            document.getElementById('sleepDurationDisplay').textContent = '--';
            setSleepFeeling('');

            // 重置运动
            renderExerciseSessions(null);

            // 重置饮食
            MEALS.forEach(m => {
                const toggle = document.getElementById(m + 'Toggle');
                const content = document.getElementById(m + 'Content');
                const feeling = document.getElementById(m + 'Feeling');
                toggle.textContent = '✅ 吃了';
                toggle.classList.add('active');
                content.disabled = false;
                content.value = '';
                feeling.disabled = false;
                feeling.value = '';
            });

            if (dayData) {
                // ---- 睡眠 ----
                if (dayData.sleep) {
                    document.getElementById('sleepBedtime').value = dayData.sleep.bedtime || '';
                    document.getElementById('sleepWakeTime').value = dayData.sleep.wakeTime || '';
                    document.getElementById('deepSleepSlider').value = dayData.sleep.deepSleepPct ?? 15;
                    updateDeepSleepValue();
                    document.getElementById('awakeCount').value = dayData.sleep.awakeCount ?? '0';
                    document.getElementById('sleepNotes').value = dayData.sleep.notes || '';
                    // 加载零星睡眠数据
                    if (dayData.sleep.naps && dayData.sleep.naps.length > 0) {
                        document.getElementById('napMinutes').value = dayData.sleep.naps[0].durationMin || '';
                    } else {
                        document.getElementById('napMinutes').value = '';
                    }
                    calcSleepDuration();
                    setSleepFeeling(dayData.sleep.feeling || '');
                // ---- 运动 ----
                if (dayData.exercise) {
                    const sessions = dayData.exercise.sessions || [];
                    if (sessions.length > 0) {
                        renderExerciseSessions(sessions);
                    }
                }
                // ---- 饮食 ----
                if (dayData.diet) {
                    MEALS.forEach(m => {
                        const info = dayData.diet[m];
                        const toggle = document.getElementById(m + 'Toggle');
                        const content = document.getElementById(m + 'Content');
                        const feeling = document.getElementById(m + 'Feeling');
                        if (info && info.ate) {
                            toggle.textContent = '✅ 吃了';
                            toggle.classList.add('active');
                            content.disabled = false;
                            content.value = info.content || '';
                            feeling.disabled = false;
                            feeling.value = info.feeling || '';
                        } else {
                            toggle.textContent = '❌ 没吃';
                            toggle.classList.remove('active');
                            content.disabled = true;
                            content.value = '';
                            feeling.disabled = true;
                            feeling.value = '';
                        }
                    });
                }
                // ---- 吃药 ----
                if (dayData.medication) {
                    if (dayData.medication.records) renderMedRecords(dayData.medication.records);
                    const medDiaryEl = document.getElementById('medDiary');
                    if (medDiaryEl) medDiaryEl.value = dayData.medication.dailyNote || '';
                } else {
                    renderMedRecords([]);
                    const medDiaryEl = document.getElementById('medDiary');
                    if (medDiaryEl) medDiaryEl.value = '';
                }
                // ---- 喝水 ----
                setWaterData(dayData.waterIntake || []);
            } else {
                // 无数据：清空吃药和喝水
                renderMedRecords([]);
                const medDiaryEl2 = document.getElementById('medDiary');
                if (medDiaryEl2) medDiaryEl2.value = '';
                setWaterData([]);
            }
        }

        // 翻页
        function navigateDay(delta) {
            const d = new Date(currentViewDate + 'T00:00:00');
            d.setDate(d.getDate() + delta);
            const newDate = dateStr(d);
            if (delta > 0 && newDate > todayStr()) return;
            loadDate(newDate);
        }

        // 回到今天
        function goToToday() {
            loadDate(todayStr());
        }

        function animateFlip(newDate, direction) {
            var content = document.getElementById('dailyContent');
            if (!content) { loadDate(newDate); return; }
            var outClass = direction > 0 ? 'slide-out-left' : 'slide-out-right';
            var inClass = direction > 0 ? 'slide-in-right' : 'slide-in-left';
            content.classList.add(outClass);
            setTimeout(function() {
                loadDate(newDate);
                content.classList.remove(outClass);
                content.classList.add(inClass);
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        content.classList.remove(inClass);
                    });
                });
            }, 260);
        }

        // 跳转到指定日期
        function goToDate(ds) {
            if (ds > todayStr()) return;
            loadDate(ds);
        }

        // ================================================================
        //  绘制周日历导航条
        // ================================================================
        function renderWeekStrip(activeDateStr) {
            const strip = document.getElementById('weekStrip');
            const monday = getMonday(activeDateStr);
            const today = todayStr();
            const allData = getData();
            const DAY_NAMES_CN = ['一', '二', '三', '四', '五', '六', '日'];

            let html = '';
            for (let i = 0; i < 7; i++) {
                const d = new Date(monday);
                d.setDate(d.getDate() + i);
                const ds = dateStr(d);
                const hasData = !!allData[ds];
                const isToday = ds === today;
                const isActive = ds === activeDateStr;
                const isFuture = ds > today;

                let cls = 'day-cell';
                if (hasData) cls += ' has-data';
                if (isToday) cls += ' today';
                if (isActive) cls += ' active';
                if (isFuture) cls += ' future';

                const onclick = isFuture ? '' : ` onclick="goToDate('${ds}')"`;

                html += `<div class="${cls}"${onclick}>`;
                html += `<span class="day-name">${DAY_NAMES_CN[i]}</span>`;
                html += `<span class="day-num">${d.getDate()}</span>`;
                html += `<span class="data-dot"></span>`;
                html += `</div>`;
            }
            strip.innerHTML = html;
        }

        // ================================================================
        //  保存当前选定日期的记录
        // ================================================================
        async function saveDaily() {
            try {
                const btn = document.getElementById('saveBtn');
                btn.disabled = true;
                btn.textContent = '⏳ 保存中...';

                const dateStr = currentViewDate;

                // ---- 睡眠 ----
                const bedtime = document.getElementById('sleepBedtime').value;
                const wakeTime = document.getElementById('sleepWakeTime').value;
                const deepSleepPct = document.getElementById('deepSleepSlider').value;
                const awakeCount = document.getElementById('awakeCount').value;
                const sleepNotes = document.getElementById('sleepNotes').value.trim();

                let durationMin = null;
                if (bedtime && wakeTime) {
                    const [bh, bm] = bedtime.split(':').map(Number);
                    const [wh, wm] = wakeTime.split(':').map(Number);
                    let dm = (wh * 60 + wm) - (bh * 60 + bm);
                    if (dm < 0) dm += 24 * 60;
                    durationMin = dm;
                }

                const sleep = {
                    bedtime: bedtime || '',
                    wakeTime: wakeTime || '',
                    durationMin: durationMin,
                    deepSleepPct: deepSleepPct !== '' ? +deepSleepPct : null,
                    awakeCount: awakeCount !== '' ? +awakeCount : 0,
                    feeling: getSleepFeeling(),
                    notes: sleepNotes,
                    naps: collectNaps()
                };

                // ---- 运动 ----
                const sessions = collectExerciseSessions().filter(s => s.duration != null && s.duration > 0);
                const exercise = { sessions };

                // ---- 饮食 ----
                const diet = {};
                MEALS.forEach(m => {
                    const toggle = document.getElementById(m + 'Toggle');
                    const content = document.getElementById(m + 'Content');
                    const feeling = document.getElementById(m + 'Feeling');
                    const ate = toggle.textContent.includes('✅');
                    diet[m] = {
                        ate: ate,
                        content: ate ? content.value.trim() : '',
                        feeling: ate ? feeling.value.trim() : ''
                    };
                });

                const medDiary = document.getElementById('medDiary')?.value.trim() || '';
                const medication = { records: collectMedRecords(), dailyNote: medDiary };
                const waterIntake = getWaterData();
                const record = { sleep, exercise, diet, medication, waterIntake };
                await saveDayData(dateStr, record);

                const toast = document.getElementById('saveToast');
                toast.textContent = '✅ 已保存！';
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2000);
                renderWeekStrip(currentViewDate);
                renderStorageInfo();
            } catch(e) {
                const toast = document.getElementById('saveToast');
                toast.textContent = '❌ 保存失败！';
                toast.style.color = '#e87171';
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                    toast.style.color = '#4a7c59';
                    toast.textContent = '✅ 已保存！';
                }, 4000);
            } finally {
                const btn = document.getElementById('saveBtn');
                btn.disabled = false;
                btn.textContent = '💾 保存今日记录';
            }
        }

        // ================================================================
        //  周总结渲染
        // ================================================================
        let currentWeekMonday = getMonday(todayStr());
        let chartInstances = {};

        function shiftWeek(delta) {
            currentWeekMonday.setDate(currentWeekMonday.getDate() + delta * 7);
            renderWeekly();
        }

        function renderWeekly() {
            const mon = currentWeekMonday;
            document.getElementById('weekLabel').textContent = formatWeekLabel(mon);
            const dates = getWeekDates(mon);

            const allData = getData();
            const weekRecords = [];
            dates.forEach(d => {
                if (allData[d]) {
                    weekRecords.push({ date: d, record: allData[d] });
                }
            });

            renderSleepSummary(weekRecords, dates);
            renderExerciseSummary(weekRecords, dates);
            renderDietSummary(weekRecords, dates);
        }

        // ---- 睡眠总结 ----
        function renderSleepSummary(weekRecords, dates) {
            const records = weekRecords.filter(r => r.record.sleep && r.record.sleep.bedtime);

            let totalDuration = 0,
                countDuration = 0;
            let totalDeep = 0,
                countDeep = 0;
            let totalAwake = 0,
                countAwake = 0;

            records.forEach(r => {
                const s = r.record.sleep;
                if (s.durationMin != null) { totalDuration += s.durationMin;
                    countDuration++; }
                if (s.deepSleepPct != null) { totalDeep += s.deepSleepPct;
                    countDeep++; }
                if (s.awakeCount != null) { totalAwake += s.awakeCount;
                    countAwake++; }
            });

            document.getElementById('statAvgDuration').textContent =
                countDuration > 0 ? (totalDuration / countDuration / 60).toFixed(1) + 'h' : '--';
            document.getElementById('statAvgDeep').textContent =
                countDeep > 0 ? (totalDeep / countDeep).toFixed(1) + '%' : '--';
            document.getElementById('statAvgAwake').textContent =
                countAwake > 0 ? (totalAwake / countAwake).toFixed(1) + '次' : '--';

            const labels = dates.map(d => {
                const [y, m, day] = d.split('-');
                return (+m) + '/' + (+day);
            });

            const durationData = dates.map(d => {
                const r = weekRecords.find(w => w.date === d);
                return (r && r.record.sleep && r.record.sleep.durationMin != null) ?
                    +(r.record.sleep.durationMin / 60).toFixed(1) :
                    null;
            });

            const bedtimeData = dates.map(d => {
                const r = weekRecords.find(w => w.date === d);
                if (r && r.record.sleep && r.record.sleep.bedtime) {
                    const [h, m] = r.record.sleep.bedtime.split(':').map(Number);
                    return +(h + m / 60).toFixed(1);
                }
                return null;
            });

            const deepData = dates.map(d => {
                const r = weekRecords.find(w => w.date === d);
                return (r && r.record.sleep && r.record.sleep.deepSleepPct != null) ?
                    r.record.sleep.deepSleepPct :
                    null;
            });

            const noteTexts = records
                .filter(r => r.record.sleep.notes)
                .map(r => {
                    const [y, m, d] = r.date.split('-');
                    return `【${+m}月${+d}日】${r.record.sleep.notes}`;
                });
            document.getElementById('sleepNotesSummary').textContent =
                noteTexts.length > 0 ? noteTexts.join('\n') : '本周没有记录备注信息';

            // 睡后感受统计
            const feelMap = { clear: '✨ 头脑清醒', heavy: '🪨 身体沉重', drowsy: '💤 困倦疲惫', burnout: '🔋 快熬穿了' };
            const feelCount = {};
            records.filter(r => r.record.sleep.feeling).forEach(r => {
                const f = r.record.sleep.feeling;
                feelCount[f] = (feelCount[f] || 0) + 1;
            });
            const feelSummary = Object.entries(feelCount)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${feelMap[k] || k} ${v}天`)
                .join(' · ');
            const feelEl = document.getElementById('sleepFeelSummary');
            if (feelEl) {
                feelEl.textContent = feelSummary || '本周未记录睡后感受';
                if (feelCount.burnout >= 2 || feelCount.drowsy >= 3) {
                    feelEl.innerHTML = feelSummary + '<br><span style="font-size:12px;color:#e87171;">⚠ 疲劳天数偏多，建议关注睡眠质量和时长</span>';
                }
            }

            drawChart('sleepDurationChart', 'line', labels, [{
                label: '睡眠时长 (小时)',
                data: durationData,
                borderColor: '#4a7c59',
                backgroundColor: 'rgba(74,124,89,0.12)',
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 7,
                spanGaps: true
            }]);

            drawChart('sleepBedtimeChart', 'line', labels, [{
                label: '入睡时间 (时)',
                data: bedtimeData,
                borderColor: '#7b5ea7',
                backgroundColor: 'rgba(123,94,167,0.12)',
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 7,
                spanGaps: true
            }], {
                min: 20,
                max: 26,
                ticks: {
                    stepSize: 0.5,
                    callback: function(v) {
                        const h = Math.floor(v);
                        const m = Math.round((v - h) * 60);
                        return h + ':' + (m < 10 ? '0' : '') + m;
                    }
                }
            });

            drawChart('deepSleepChart', 'line', labels, [{
                label: '深度睡眠占比 (%)',
                data: deepData,
                borderColor: '#3a8fb5',
                backgroundColor: 'rgba(58,143,181,0.12)',
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 7,
                spanGaps: true
            }]);
        }

        // ---- 运动总结 ----
        function renderExerciseSummary(weekRecords, dates) {
            const labels = dates.map(d => {
                const [y, m, day] = d.split('-');
                return (+m) + '/' + (+day);
            });

            // 每天的总运动时长（所有session合计）
            const exData = dates.map(d => {
                const r = weekRecords.find(w => w.date === d);
                if (!r || !r.record.exercise || !r.record.exercise.sessions) return 0;
                return r.record.exercise.sessions
                    .filter(s => s.duration != null)
                    .reduce((a, s) => a + s.duration, 0);
            });

            const exDays = exData.filter(v => v > 0).length;
            const totalMin = exData.reduce((a, b) => a + b, 0);
            const avgMin = exDays > 0 ? Math.round(totalMin / 7) : 0;

            document.getElementById('statExerciseDays').textContent = exDays + '天';
            document.getElementById('statExAvgDuration').textContent = avgMin + '分钟';
            document.getElementById('statTotalDuration').textContent = totalMin + '分钟';

            drawChart('exerciseChart', 'bar', labels, [{
                label: '运动时长 (分钟)',
                data: exData,
                backgroundColor: exData.map(v => v > 0 ? 'rgba(74,124,89,0.7)' : 'rgba(200,190,180,0.3)'),
                borderColor: exData.map(v => v > 0 ? '#4a7c59' : '#ccc'),
                borderWidth: 1,
                borderRadius: 4,
            }], { beginAtZero: true });

            // 运动种类统计
            const typeCount = {};
            weekRecords.forEach(r => {
                if (r.record.exercise && r.record.exercise.sessions) {
                    r.record.exercise.sessions.forEach(s => {
                        typeCount[s.type] = (typeCount[s.type] || 0) + 1;
                    });
                }
            });
            const typeSummary = Object.entries(typeCount)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k} ${v}次`)
                .join('、');
            document.getElementById('exerciseNotesSummary').textContent =
                typeSummary ? `本周运动项目：${typeSummary}` :
                (exDays > 0 ? `本周运动${exDays}天，共${totalMin}分钟` : '本周暂无运动记录');
        }

        // ---- 饮食总结 ----
        function renderDietSummary(weekRecords, dates) {
            let hasData = false;
            let fullMealDays = 0;
            let recordDays = 0;
            const allFeelings = [];

            dates.forEach(d => {
                const r = weekRecords.find(w => w.date === d);
                if (!r || !r.record.diet) return;
                const diet = r.record.diet;
                let ateCount = 0;
                let dayFeelings = [];

                MEALS.forEach(m => {
                    const info = diet[m];
                    if (info && info.ate) {
                        ateCount++;
                        hasData = true;
                        if (info.feeling) {
                            const [y, mon, day] = d.split('-');
                            dayFeelings.push(`${MEAL_NAMES[m]}：${info.feeling}`);
                        }
                    }
                });

                if (ateCount > 0) recordDays++;
                if (ateCount === 3) fullMealDays++;
                if (dayFeelings.length > 0) {
                    const [y, mon, day] = d.split('-');
                    allFeelings.push(`【${+mon}月${+day}日】${dayFeelings.join('，')}`);
                }
            });

            document.getElementById('statMealDays').textContent =
                hasData ? recordDays + '天' : '--';
            document.getElementById('statFullMealDays').textContent =
                hasData ? fullMealDays + '天' : '--';

            document.getElementById('dietNotesSummary').textContent =
                allFeelings.length > 0 ? allFeelings.join('\n') :
                (hasData ? '本周没有记录饮食感受' : '暂无数据');
        }

        // ---- 通用图表绘制 ----
        function drawChart(canvasId, type, labels, datasets, extraOpts) {
            const canvas = document.getElementById(canvasId);
            if (chartInstances[canvasId]) {
                chartInstances[canvasId].destroy();
                delete chartInstances[canvasId];
            }

            const ctx = canvas.getContext('2d');
            const opts = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: datasets.length > 1,
                        position: 'top',
                        labels: { boxWidth: 12, padding: 12, font: { size: 12 } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(50,50,50,0.9)',
                        padding: 10,
                        bodyFont: { size: 13 },
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 }, color: '#888' }
                    },
                    y: {
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 11 }, color: '#888' }
                    }
                }
            };

            if (extraOpts) {
                if (extraOpts.min !== undefined || extraOpts.max !== undefined) {
                    opts.scales.y.min = extraOpts.min;
                    opts.scales.y.max = extraOpts.max;
                }
                if (extraOpts.ticks) {
                    opts.scales.y.ticks = { ...opts.scales.y.ticks, ...extraOpts.ticks };
                }
                if (extraOpts.beginAtZero) {
                    opts.scales.y.beginAtZero = true;
                }
            }

            chartInstances[canvasId] = new Chart(ctx, {
                type: type,
                data: { labels, datasets },
                options: opts
            });
        }

        // ================================================================
        //  数据导入/导出
        // ================================================================
        function exportData() {
            const data = getData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '健康小记_备份_' + todayStr() + '.json';
            a.click();
            URL.revokeObjectURL(url);
        }

        async function importData(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const imported = JSON.parse(e.target.result);
                    const current = getData();
                    for (const key of Object.keys(imported)) {
                        current[key] = imported[key];
                    }
                    await setData(current);
                    alert('✅ 导入成功！共导入 ' + Object.keys(imported).length + ' 条记录。');
                    if (currentTab === 'daily') loadDate(currentViewDate);
                    else renderWeekly();
                } catch (err) {
                    alert('❌ 文件格式不对，请选择正确的备份文件。');
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        // ================================================================
        //  初始化
        // ================================================================
        document.addEventListener('DOMContentLoaded', async function() {
            try { await initStorage(); } catch(e) { console.error('initStorage:', e); }
            if (!hasProfile()) { showOnboarding(); }
            else { try { updateProfileUI(); } catch(e) { console.error('updateProfileUI:', e); } }
            try { loadDate(todayStr()); } catch(e) { console.error('loadDate:', e); }
            document.addEventListener('keydown', function(e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    saveDaily();
                }
            });
        });

        // 注册 Service Worker（PWA 离线支持）
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').then(function() {
                console.log('SW registered');
            }).catch(function(err) {
                console.log('SW failed:', err);
            });
        }
    
        // ================================================================
        //  零星睡眠 / 午睡
        // ================================================================
                

                function collectNaps() {
            const val = document.getElementById('napMinutes')?.value;
            if (val && +val > 0) {
                return [{ durationMin: +val }];
            }
            return [];
        }

// ================================================================
        //  吃药记录
        // ================================================================
        let medCount=0;
        function createMedRecordHTML(i,t,d,n) {
            return `<div class="med-record" data-med-index="${i}"><span class="mlbl">第${i+1}次</span><input type="time" class="med-time" value="${t||''}" placeholder="时间"><input type="number" class="med-dosage" value="${d||''}" min="0" max="99" step="0.5"><span class="munit">次/粒</span><input type="text" class="med-notes" value="${n||''}" placeholder="备注"><button class="mclose" onclick="removeMedRecord(this)">✕</button></div>`;
        }
        function renderMedRecords(r) {
            const c=document.getElementById('medRecords');const d=r||[];medCount=d.length;
            c.innerHTML=d.length?d.map((r,i)=>createMedRecordHTML(i,r.time,r.dosage,r.notes)).join(''):'<div class="med-empty">今天还没记录吃药</div>';
        }
        function addMedRecord() {
            const c=document.getElementById('medRecords');if(c.querySelector('.med-empty'))c.innerHTML='';
            c.insertAdjacentHTML('beforeend',createMedRecordHTML(medCount,'','',''));medCount++;
        }
        function removeMedRecord(b) {
            const r=b.closest('.med-record');r.remove();medCount--;
            document.querySelectorAll('.med-record').forEach((r,i)=>{r.dataset.medIndex=i;r.querySelector('.mlbl').textContent='第'+(i+1)+'次';});
            if(!document.querySelectorAll('.med-record').length)document.getElementById('medRecords').innerHTML='<div class="med-empty">今天还没记录吃药</div>';
        }
        function collectMedRecords() {
            const records=[];
            document.querySelectorAll('.med-record').forEach(r=>{
                const t=r.querySelector('.med-time').value,d=r.querySelector('.med-dosage').value,n=r.querySelector('.med-notes').value.trim();
                if(t&&d)records.push({time:t,dosage:d!==''?+d:null,notes:n});
            });
            return records;
        }

        // ================================================================
        //  喝水记录
        // ================================================================
        const WATER_GOAL = 2000;
        let _waterList = [];     // [{time:'08:30', ml:200}]          纯水，计入总量
        let _beverageList = [];  // [{time:'09:00', ml:250, label:'咖啡'}] 饮品，不计入总量

        function addWaterItem(ml) {
            const now = new Date();
            const time = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
            _waterList.push({ time, ml });
            renderAllWater();
        }
        function addWaterCustom() {
            const inp = document.getElementById('waterCustomInput');
            const ml = parseInt(inp.value) || 0;
            if (ml < 50 || ml > 2000) { inp.value = 200; return; }
            addWaterItem(ml);
            inp.value = 200;
        }
        function removeWaterItem(index) {
            _waterList.splice(index, 1);
            renderAllWater();
        }
        function addBeverageItem(ml, label) {
            const now = new Date();
            const time = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
            _beverageList.push({ time, ml, label: label || '饮料' });
            renderAllWater();
        }
        function addBeverageCustom() {
            const mlInp = document.getElementById('beverageCustomMl');
            const lblInp = document.getElementById('beverageCustomLabel');
            const ml = parseInt(mlInp.value) || 0;
            const label = lblInp.value.trim() || '饮料';
            if (ml < 50 || ml > 2000) { mlInp.value = 200; return; }
            addBeverageItem(ml, label);
            mlInp.value = 200;
            lblInp.value = '饮料';
        }
        function removeBeverageItem(index) {
            _beverageList.splice(index, 1);
            renderAllWater();
        }
        function renderAllWater() {
            // 饮水进度条（只算纯水）
            const total = _waterList.reduce((s, r) => s + r.ml, 0);
            const pct = Math.min(100, Math.round((total / WATER_GOAL) * 100));
            document.getElementById('waterTotal').textContent = total + 'ml';
            document.getElementById('waterProgressFill').style.width = pct + '%';
            document.getElementById('waterProgressPct').textContent = pct + '%';

            // 纯水列表
            const wc = document.getElementById('waterRecords');
            if (_waterList.length === 0) {
                wc.innerHTML = '<div class="water-empty">今天还没喝过水</div>';
            } else {
                wc.innerHTML = _waterList.map((r, i) =>
                    `<div class="water-record-row">
                        <span class="w-time">${r.time}</span>
                        <span class="w-amount">${r.ml}ml</span>
                        <span class="w-label">💧 水</span>
                        <button class="w-del" onclick="removeWaterItem(${i})" title="删除">✕</button>
                    </div>`
                ).join('');
            }

            // 饮品列表
            const bc = document.getElementById('beverageRecords');
            if (_beverageList.length === 0) {
                bc.innerHTML = '<div class="water-empty">暂无其他饮品记录</div>';
            } else {
                bc.innerHTML = _beverageList.map((r, i) =>
                    `<div class="water-record-row">
                        <span class="w-time">${r.time}</span>
                        <span class="w-amount">${r.ml}ml</span>
                        <span class="w-label">🥤 ${r.label}</span>
                        <button class="w-del" onclick="removeBeverageItem(${i})" title="删除">✕</button>
                    </div>`
                ).join('');
            }
        }
        function getWaterData() {
            return {
                water: _waterList.length > 0 ? _waterList.slice() : [],
                beverages: _beverageList.length > 0 ? _beverageList.slice() : []
            };
        }
        function setWaterData(data) {
            if (Array.isArray(data)) {
                // 兼容旧格式：根据 label 判断是水还是饮品
                _waterList = []; _beverageList = [];
                data.forEach(item => {
                    if (!item.label || item.label === '水') _waterList.push({ time: item.time, ml: item.ml });
                    else _beverageList.push({ time: item.time, ml: item.ml, label: item.label });
                });
            } else {
                _waterList = (data && data.water) ? data.water.slice() : [];
                _beverageList = (data && data.beverages) ? data.beverages.slice() : [];
            }
            renderAllWater();
        }

        // ================================================================
        //  身份选择 / 设置
        // ================================================================
        const IDENTITY_LABELS={office:'💼 上班族',wellness:'🌿 养生党'};
        function showOnboarding(){document.getElementById('onboardingOverlay').classList.remove('hidden');}
        function selectIdentity(id){
            try {
                if(id==='wellness'){
                    document.getElementById('medDialog').classList.remove('hidden');
                } else {
                    setProfileAndFinish(id,false);
                }
            } catch(e) { console.error('selectIdentity:', e); }
        }
        async function setProfileAndFinish(identity,trackMed){
            try {
                document.getElementById('medDialog').classList.add('hidden');
                await setProfile({identity:identity,trackMedication:trackMed});
                document.getElementById('onboardingOverlay').classList.add('hidden');
                updateProfileUI();
                updateSectionVisibility();
                if(currentTab==='daily') loadDate(currentViewDate); else renderWeekly();
            } catch(e) { console.error('setProfileAndFinish:', e); }
        }
        window.setProfileAndFinish = setProfileAndFinish;
        function updateProfileUI(){
            const p=getProfile(),badge=document.getElementById('profileBadge'),text=document.getElementById('profileBadgeText');
            if(p){badge.classList.remove('hidden');text.textContent=IDENTITY_LABELS[p.identity]||p.identity;}
            else badge.classList.add('hidden');
        }
        function showSettings(){
            const p=getProfile();if(!p)return;
            document.getElementById('settingsIdentity').textContent=IDENTITY_LABELS[p.identity]||p.identity;
            document.getElementById('settingsMed').textContent=p.identity==='wellness'?(p.trackMedication?'✅ 记录':'❌ 不记录'):'—';
            document.getElementById('deepseekKey').value = getDeepseekKey();
            document.getElementById('settingsModal').classList.remove('hidden');
        }
        function hideSettings(){document.getElementById('settingsModal').classList.add('hidden');}
        async function resetProfile(){hideSettings();await setProfile(null);showOnboarding();}
        function updateSectionVisibility(){
            const mc=document.getElementById('medCard');
            const wc=document.getElementById('waterCard');
            const p=getProfile();
            // 吃药卡片：养生党+需要吃药才显示
            if(shouldTrackMedication())mc.classList.add('visible');else mc.classList.remove('visible');
            // 喝水卡片：上班族显示
            if(p&&p.identity==='office')wc.classList.add('visible'); else wc.classList.remove('visible');
        }
        document.addEventListener('click',function(e){
            if(e.target===document.getElementById('settingsModal'))hideSettings();
            if(e.target===document.getElementById('medDialog'))document.getElementById('medDialog').classList.add('hidden');
        });
        }
        function saveDeepseekKey() {
            var key = document.getElementById('deepseekKey').value.trim();
            localStorage.setItem('deepseek_api_key', key);
            alert(key ? '✅ API Key 已保存' : '✅ API Key 已清除');
        }
        function getDeepseekKey() { return localStorage.getItem('deepseek_api_key') || ''; }
        async function requestAIAnalysis() {
            var key = getDeepseekKey();
            if (!key) { alert('⚠️ 请先在设置中填写 DeepSeek API Key'); return; }
            var btn = document.getElementById('aiBtn');
            var load = document.getElementById('aiLoading');
            var err = document.getElementById('aiError');
            var result = document.getElementById('aiResult');
            btn.disabled = true; load.style.display = 'block'; err.style.display = 'none';
            try {
                // 收集本周数据
                var monday = getMonday(todayStr());
                var dates = []; for (var i = 0; i < 7; i++) { var d = new Date(monday); d.setDate(d.getDate()+i); dates.push(dateStr(d)); }
                var records = dates.map(function(ds) { return getDayData(ds); }).filter(Boolean);
                if (records.length === 0) { result.textContent = '本周暂无数据，请先记录再分析'; return; }
                var summary = { sleep: [], exercise: [], diet: [] };
                records.forEach(function(r) {
                    if (r.sleep && r.sleep.bedTime && r.sleep.wakeTime) summary.sleep.push({ bed: r.sleep.bedTime, wake: r.sleep.wakeTime, deep: r.sleep.deepMinutes || 0, awake: r.sleep.awakeCount || 0, note: r.sleep.notes || '' });
                    if (r.exercise && r.exercise.sessions) r.exercise.sessions.forEach(function(s) { summary.exercise.push(s); });
                    if (r.diet) summary.diet.push(r.diet);
                });
                var prompt = '你是专业健康管理师。以下是用户本周记录，请用中文给出500字以内的健康周总结，包括：1)睡眠分析（时长、规律性）2)运动建议 3)饮食反馈 4)综合建议。语气温暖有鼓励感。\n数据：' + JSON.stringify(summary);
                var resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
                    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.7 })
                });
                if (!resp.ok) throw new Error('API 错误 ' + resp.status);
                var data = await resp.json();
                result.textContent = data.choices[0].message.content;
            } catch(e) {
                err.textContent = '❌ 分析失败：' + e.message;
                err.style.display = 'block';
            } finally {
                btn.disabled = false; load.style.display = 'none';
            }
        }

        // ================================================================
        //  PWA 安装
        // ================================================================
        let deferredPrompt = null;
        window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            deferredPrompt = e;
            var btn = document.getElementById('installBtn');
            if (btn) btn.style.display = 'inline-block';
        });
        function showInstallPrompt() {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(function(result) {
                    var btn = document.getElementById('installBtn');
                    if (result.outcome === 'accepted') { if (btn) btn.style.display = 'none'; }
                    deferredPrompt = null;
                });
            } else {
                alert('请通过浏览器菜单「添加到主屏幕」安装\n\niOS: 点底部分享按钮 → 添加到主屏幕\nAndroid: 点右上角菜单 → 安装应用');
            }
        }
        // 如果已经是 standalone 模式，隐藏安装按钮
        if (window.matchMedia('(display-mode: standalone)').matches) {
            var ib = document.getElementById('installBtn');
            if (ib) ib.style.display = 'none';
        }

