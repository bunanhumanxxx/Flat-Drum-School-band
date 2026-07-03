// GAS Backend URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzAo8Ogvx7GCIK4Po7zPpjgz3km8jzlLo7tgFe8Ztt4-n9K1bITaLL_XZe2K3rvsjWWag/exec';
const SECURITY_TOKEN = "fds_secret_2026";

// DOM Elements
const listContainer = document.getElementById('list-container');
const addBtn = document.getElementById('add-btn');
const modal = document.getElementById('modal');
const form = document.getElementById('recruitment-form');
const cancelBtn = document.getElementById('cancel-btn');
const modalTitle = document.getElementById('modal-title');
const addOtherPartBtn = document.getElementById('add-other-part-btn');

// Candidate DOM Elements
const candidateModal = document.getElementById('candidate-modal');
const candidateForm = document.getElementById('candidate-form');
const candidateCancelBtn = document.getElementById('candidate-cancel-btn');
const candidateModalTitle = document.getElementById('candidate-modal-title');
const candidateItemIdInput = document.getElementById('candidate-item-id');
const candidatePartInput = document.getElementById('candidate-part');

// Detail DOM Elements
const detailModal = document.getElementById('detail-modal');
const detailContent = document.getElementById('detail-content');
const detailCloseBtn = document.getElementById('detail-close-btn');

// Loading Display
function showLoading() {
    const loader = document.getElementById('loading-overlay');
    loader.classList.remove('hidden');
    // Ensure display is flex to override any potential conflict
    loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('loading-overlay');
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = ''; }, 300);
}

// 状態管理
let items = [];

// ヘルパー
function getRequiredCount(item, part) {
    return (item.partCounts && item.partCounts[part]) ? item.partCounts[part] : 1;
}

function getCandidateCount(item, part) {
    return (item.candidates && item.candidates[part]) ? item.candidates[part].length : 0;
}

function checkAllFilled(item) {
    if (!item.parts || item.parts.length === 0) return false;
    return item.parts.every(p => {
        const req = getRequiredCount(item, p);
        const cur = getCandidateCount(item, p);
        return cur >= req;
    });
}

function addCustomPartRow(nameStr = '', countNum = 1) {
    const container = document.getElementById('custom-parts-container');
    const row = document.createElement('div');
    row.className = 'part-row custom-part-row';
    row.style.marginTop = '8px';

    row.innerHTML = `
        <div style="flex:1;"><input type="text" class="custom-part-name" placeholder="楽器名" style="width:100%; padding:6px; font-size:0.9rem; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:white; border-radius:4px;" required></div>
        <div class="part-count-wrapper">
            <button type="button" class="spin-btn decrease-btn">－</button>
            <input type="number" class="part-num-input custom-part-num" min="1" max="99" value="${countNum}" readonly>
            <button type="button" class="spin-btn increase-btn">＋</button>
            <span>人</span>
            <button type="button" class="del-custom-row-btn" style="background:transparent; border:none; color:#fca5a5; font-size:1.2rem; cursor:pointer; padding:0 8px; min-height:44px; display:inline-flex; align-items:center; margin-left:4px;">×</button>
        </div>
    `;

    row.querySelector('.custom-part-name').value = nameStr;

    row.querySelector('.del-custom-row-btn').addEventListener('click', () => {
        row.remove();
    });

    container.appendChild(row);
}


// ============== サーバー通信（バックエンド同期） ==============

// 初期データの読み込み（サーバーからGET）
async function loadItems() {
    showLoading();
    try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        items = Array.isArray(data) ? data : [];
    } catch (err) {
        console.error("Fetch Error:", err);
        items = []; // エラー時は空枠にするか、localStorageのキャッシュを使うなどの運用も可能
    } finally {
        hideLoading();
        renderItems();
    }
}

// データの保存（サーバーへPOST）
async function saveItems() {
    // 1. UIのレスポンスを良くするため、ローカルの変更を先に画面へ描画（オプティミスティックUI）
    renderItems();

    // 2. バックグラウンドでサーバーへ送信
    showLoading();
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8' // CORS対策
            },
            body: JSON.stringify({
                action: 'saveAll',
                token: SECURITY_TOKEN,
                data: items
            })
        });
    } catch (err) {
        console.error("Save Error:", err);
        alert("サーバーへのデータ保存に失敗しました。時間をおいて再試行してください。");
    } finally {
        hideLoading();
    }
}

// 初期化
function init() {
    // 各チェックボックス変更時に連動して無効化/有効化するロジック
    document.querySelectorAll('input[type="checkbox"][name="part"]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const numInput = document.querySelector(`input[name="part_count_${cb.value}"]`);
            if (numInput) {
                numInput.disabled = !e.target.checked;
                const wrapper = numInput.closest('.part-count-wrapper');
                if (wrapper) wrapper.querySelectorAll('.spin-btn').forEach(b => b.disabled = !e.target.checked);
            }
            if (!e.target.checked && numInput) numInput.value = '1';
        });
    });

    // 動的スピンボタンのイベントリスナー
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('increase-btn')) {
            const input = e.target.parentElement.querySelector('.part-num-input');
            if (input && !input.disabled) {
                const max = parseInt(input.max) || 99;
                let val = parseInt(input.value) || 1;
                if (val < max) input.value = val + 1;
            }
        } else if (e.target.classList.contains('decrease-btn')) {
            const input = e.target.parentElement.querySelector('.part-num-input');
            if (input && !input.disabled) {
                const min = parseInt(input.min) || 1;
                let val = parseInt(input.value) || 1;
                if (val > min) input.value = val - 1;
            }
        }
    });

    addOtherPartBtn.addEventListener('click', () => {
        addCustomPartRow();
    });

    // 初回読み込みのトリガー
    loadItems();
}

// アイテムの描画 (一覧用)
function renderItems() {
    listContainer.innerHTML = '';

    if (items.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; color: var(--text-muted); margin-top:60px; font-size:1.1rem;">現在募集はありません。<br>「新規募集」から追加してください。</div>';
        return;
    }

    const renderList = items.map((item, index) => ({ item, index }));

    renderList.sort((a, b) => {
        const isRecruitingA = typeof a.item.status === 'string' && a.item.status.includes('募集中');
        const isRecruitingB = typeof b.item.status === 'string' && b.item.status.includes('募集中');

        if (isRecruitingA && !isRecruitingB) return -1;
        if (!isRecruitingA && isRecruitingB) return 1;
        return a.index - b.index;
    });

    renderList.forEach((wrapper) => {
        const item = wrapper.item;
        const index = wrapper.index;

        if (!item.candidates) item.candidates = {};
        if (!item.partCounts) item.partCounts = {};

        const trueNumber = index + 1;
        const isRecruiting = typeof item.status === 'string' && item.status.includes('募集中');
        const statusClass = isRecruiting ? 'active' : 'closed';

        const card = document.createElement('div');
        card.className = 'item-card' + (isRecruiting ? '' : ' closed-card');

        const partsContainer = document.createElement('div');
        partsContainer.className = 'parts-list';

        if (item.parts && item.parts.length > 0) {
            item.parts.forEach(part => {
                const req = getRequiredCount(item, part);
                const cur = getCandidateCount(item, part);
                const hasCandidate = cur >= req;

                const partTag = document.createElement('span');
                partTag.className = 'part-tag' + (hasCandidate ? ' filled' : '') + ((isRecruiting && !hasCandidate) ? ' clickable' : '');

                // 募集人数が2人以上の場合は (1/2) のように表示
                const displayCount = req > 1 ? ` (${cur}/${req})` : '';
                partTag.textContent = part + displayCount;

                if (isRecruiting && !hasCandidate) {
                    partTag.title = `${part} に立候補する`;
                    partTag.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openCandidateModal(item.id, part);
                    });
                }

                partsContainer.appendChild(partTag);
            });
        } else {
            partsContainer.innerHTML = '<span class="part-tag" style="opacity: 0.5">指定なし</span>';
        }

        const musicNoteSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="15.5" r="2.5"></circle><path d="M8 17.5V5l12-2v12.5"></path><path d="M8 9l12-2"></path></svg>`;

        card.innerHTML = `
            <div class="card-header" style="margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="item-number" style="font-size:1.05rem;">NO. ${trueNumber}</span>
                    <span style="font-size:0.9rem; font-weight:500; color:#cbd5e1; display:flex; align-items:center; gap:4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        ${escapeHTML(item.author || '未設定')}
                    </span>
                </div>
                <span class="status-badge ${statusClass}">${escapeHTML(item.status)}</span>
            </div>
            <div class="song-info" style="margin-bottom:12px;">
                <h3 style="margin-bottom:6px; font-size:1.35rem; color:#ffffff; font-weight:700;">${escapeHTML(item.artist)}</h3>
                <p style="display:flex; align-items:center; gap:8px; font-size:1.05rem; font-weight:500; color:#f8fafc; margin-bottom:0;">
                    ${musicNoteSVG}
                    ${escapeHTML(item.song)}
                </p>
                ${item.comment ? `
                <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.15); font-size:0.95rem; font-weight:400; color:#cbd5e1; display:flex; gap:8px; line-height:1.5;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span style="flex:1;">${escapeHTML(item.comment)}</span>
                </div>` : ''}
            </div>
        `;

        card.appendChild(partsContainer);

        card.insertAdjacentHTML('beforeend', `
            <div class="card-actions">
                <button class="action-btn detail-btn" data-id="${item.id}">詳細</button>
                <button class="action-btn delete-btn" data-id="${item.id}">削除</button>
            </div>
        `);

        listContainer.appendChild(card);
    });

    document.querySelectorAll('.detail-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openDetailModal(e.target.dataset.id);
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteItem(e.target.dataset.id);
        });
    });
}


// ============================================
// 詳細モーダルロジック
// ============================================
function openDetailModal(id) {
    const item = items.find(i => i.id == id);
    if (!item) return;

    if (!item.partCounts) item.partCounts = {};
    if (!item.candidates) item.candidates = {};

    const isRecruiting = typeof item.status === 'string' && item.status.includes('募集中');
    const statusClass = isRecruiting ? 'active' : 'closed';
    const musicNoteSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="15.5" r="2.5"></circle><path d="M8 17.5V5l12-2v12.5"></path><path d="M8 9l12-2"></path></svg>`;

    let html = `
        <div style="margin-bottom: 24px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:20px; align-items:center;">
                <span style="font-weight:bold; color:var(--text-muted); font-size:0.95rem;">ステータス</span>
                <span class="status-badge ${statusClass}" style="transform:none; font-size: 0.9rem;">${escapeHTML(item.status)}</span>
            </div>
            <div style="margin-bottom:16px;">
                <span style="font-weight:bold; color:var(--text-muted); font-size:0.95rem; display:block; margin-bottom:4px;">投稿者</span>
                <span style="font-size:1.15rem; display:flex; align-items:center; gap:6px; color:#f8fafc;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; color:var(--text-muted);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span style="font-weight:600;">${escapeHTML(item.author || '未設定')}</span>
                </span>
            </div>
            <div style="margin-bottom:16px;">
                <span style="font-weight:bold; color:var(--text-muted); font-size:0.95rem; display:block; margin-bottom:4px;">アーティスト名</span>
                <span style="font-size:1.4rem; font-weight:700; color:#ffffff;">${escapeHTML(item.artist)}</span>
            </div>
            <div style="margin-bottom:24px;">
                <span style="font-weight:bold; color:var(--text-muted); font-size:0.95rem; display:block; margin-bottom:4px;">曲名</span>
                <span style="font-size:1.3rem; display:flex; align-items:center; gap:6px; color:#f8fafc; font-weight:500;">
                    ${musicNoteSVG}
                    ${escapeHTML(item.song)}
                </span>
            </div>
            ${item.comment ? `
            <div style="margin-bottom:28px;">
                <span style="font-weight:bold; color:var(--text-muted); font-size:0.95rem; display:block; margin-bottom:6px;">一言コメント</span>
                <div style="font-size:1.05rem; line-height: 1.6; color: #cbd5e1; display:flex; gap:10px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span style="flex:1;">${escapeHTML(item.comment).replace(/\n/g, '<br>')}</span>
                </div>
            </div>` : ''}
        </div>
        <div style="font-weight:bold; color:var(--text-muted); font-size:0.95rem; margin-bottom: 12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">募集パート</div>
        <div id="detail-parts-container"></div>
    `;

    detailContent.innerHTML = html;
    const partsCont = document.getElementById('detail-parts-container');

    const userSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    const messageSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:3px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

    if (item.parts && item.parts.length > 0) {
        item.parts.forEach(part => {
            const req = getRequiredCount(item, part);
            const cur = getCandidateCount(item, part);
            const hasCand = cur >= req;

            const partBlock = document.createElement('div');
            partBlock.style.marginBottom = '20px';

            const pTag = document.createElement('span');
            pTag.className = 'part-tag' + (hasCand ? ' filled' : '') + ((isRecruiting && !hasCand) ? ' clickable' : '');

            const displayCount = req > 1 ? ` (${cur}/${req})` : '';
            pTag.textContent = part + displayCount;

            if (isRecruiting && !hasCand) {
                pTag.title = `${part} に立候補する`;
                pTag.addEventListener('click', () => {
                    openCandidateModal(item.id, part);
                });
            }

            partBlock.appendChild(pTag);

            if (cur > 0) {
                const cList = document.createElement('div');
                cList.className = 'candidates-list';
                item.candidates[part].forEach((cand, candIndex) => {
                    cList.innerHTML += `
                        <div class="candidate-item">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="flex:1; margin-right:12px;">
                                    <div style="display:flex; align-items:center; gap:6px; font-size:1.05rem;">
                                        ${userSVG}
                                        <strong>${escapeHTML(cand.name)}</strong>
                                    </div>
                                    ${cand.note ? `
                                    <div class="candidate-note" style="display:flex; align-items:flex-start; gap:6px; margin-top:4px;">
                                        ${messageSVG}
                                        <span style="flex:1;">${escapeHTML(cand.note)}</span>
                                    </div>` : ''}
                                </div>
                                <div style="display:flex; gap:6px;">
                                    <button class="action-btn edit-cand-btn" style="font-size:0.75rem; padding:8px 12px;" data-id="${item.id}" data-part="${part}" data-index="${candIndex}">編集</button>
                                    <button class="action-btn del-cand-btn" style="font-size:0.75rem; padding:8px 12px; color:#fca5a5; border-color: rgba(239, 68, 68, 0.4);" data-id="${item.id}" data-part="${part}" data-index="${candIndex}">削除</button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                partBlock.appendChild(cList);
            }

            partsCont.appendChild(partBlock);
        });
    } else {
        partsCont.innerHTML = '<p style="color:var(--text-muted); font-size:0.95rem;">指定なし</p>';
    }

    document.querySelectorAll('.edit-cand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            openCandidateModal(btnEl.dataset.id, btnEl.dataset.part, btnEl.dataset.index);
        });
    });

    document.querySelectorAll('.del-cand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            deleteCandidate(btnEl.dataset.id, btnEl.dataset.part, btnEl.dataset.index);
        });
    });

    detailModal.classList.remove('hidden');
    requestAnimationFrame(() => detailModal.classList.add('active'));
}

function closeDetailModal() {
    detailModal.classList.remove('active');
    setTimeout(() => detailModal.classList.add('hidden'), 350);
}

detailCloseBtn.addEventListener('click', closeDetailModal);
detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
});


// ============================================
// パート立候補モーダルロジック
// ============================================
function openCandidateModal(itemId, part, index = null) {
    candidateForm.reset();
    candidateItemIdInput.value = itemId;
    candidatePartInput.value = part;
    document.getElementById('candidate-index').value = index !== null ? index : '';

    if (index !== null) {
        candidateModalTitle.textContent = `${part} 立候補情報編集`;
        const item = items.find(i => i.id == itemId);
        if (item && item.candidates && item.candidates[part]) {
            const cand = item.candidates[part][index];
            if (cand) {
                document.getElementById('candidate-name').value = cand.name;
                document.getElementById('candidate-note').value = cand.note || '';
            }
        }
    } else {
        candidateModalTitle.textContent = `${part} に立候補`;
    }

    candidateModal.classList.remove('hidden');
    requestAnimationFrame(() => {
        candidateModal.classList.add('active');
    });
}

function closeCandidateModal() {
    candidateModal.classList.remove('active');
    setTimeout(() => {
        candidateModal.classList.add('hidden');
    }, 350);
}

candidateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const itemId = candidateItemIdInput.value;
    const part = candidatePartInput.value;
    const candIndexStr = document.getElementById('candidate-index').value;
    const name = document.getElementById('candidate-name').value.trim();
    const note = document.getElementById('candidate-note').value.trim();

    if (!name) return;

    const itemIndex = items.findIndex(i => i.id == itemId);
    if (itemIndex > -1) {
        let item = items[itemIndex];
        if (!item.candidates) item.candidates = {};
        if (!item.candidates[part]) item.candidates[part] = [];

        if (candIndexStr !== '') {
            item.candidates[part][Number(candIndexStr)] = { name, note };
        } else {
            item.candidates[part].push({ name, note });
        }

        if (checkAllFilled(item)) {
            item.status = '締め切り';
        }

        saveItems();
        closeCandidateModal();

        if (!detailModal.classList.contains('hidden')) {
            openDetailModal(itemId);
        }
    }
});

candidateCancelBtn.addEventListener('click', closeCandidateModal);
candidateModal.addEventListener('click', (e) => {
    if (e.target === candidateModal) closeCandidateModal();
});

function deleteCandidate(itemId, part, candIndex) {
    if (confirm('この立候補情報を削除しますか？')) {
        const itemIndex = items.findIndex(i => i.id == itemId);
        if (itemIndex > -1) {
            let item = items[itemIndex];
            if (item.candidates && item.candidates[part]) {
                item.candidates[part].splice(candIndex, 1);

                if (!checkAllFilled(item)) {
                    item.status = '募集中';
                }

                saveItems();
                if (!detailModal.classList.contains('hidden')) {
                    openDetailModal(itemId);
                }
            }
        }
    }
}


// ============================================
// 募集枠の追加・編集モーダルロジック
// ============================================
function openModal(id = null) {
    form.reset();
    document.getElementById('custom-parts-container').innerHTML = '';
    document.querySelectorAll('input[type="number"][name^="part_count_"]').forEach(n => {
        n.disabled = true;
        n.value = '1';
        const wrapper = n.closest('.part-count-wrapper');
        if (wrapper) wrapper.querySelectorAll('.spin-btn').forEach(b => b.disabled = true);
    });

    if (id) {
        modalTitle.textContent = '募集を編集';
        const item = items.find(i => i.id == id);
        if (item) {
            document.getElementById('item-id').value = item.id;

            document.getElementById('status-group').style.display = 'block';
            const isRecruiting = item.status.includes('募集中');
            document.getElementById('status').value = isRecruiting ? '募集中' : '締め切り';

            document.getElementById('author').value = item.author || '';
            document.getElementById('artist').value = item.artist;
            document.getElementById('song').value = item.song;
            document.getElementById('board-comment').value = item.comment || '';

            const standardParts = ['Vo.', 'Gt.', 'Ba.', 'Dr.'];

            document.querySelectorAll('input[type="checkbox"][name="part"]').forEach(cb => {
                cb.checked = item.parts.includes(cb.value);
                const numInput = document.querySelector(`input[name="part_count_${cb.value}"]`);
                if (cb.checked && numInput) {
                    numInput.disabled = false;
                    numInput.value = (item.partCounts && item.partCounts[cb.value]) ? item.partCounts[cb.value] : '1';
                    const wrapper = numInput.closest('.part-count-wrapper');
                    if (wrapper) wrapper.querySelectorAll('.spin-btn').forEach(b => b.disabled = false);
                }
            });

            item.parts.forEach(p => {
                if (!standardParts.includes(p)) {
                    const count = (item.partCounts && item.partCounts[p]) ? item.partCounts[p] : 1;
                    addCustomPartRow(p, count);
                }
            });
        }
    } else {
        modalTitle.textContent = '新規募集';
        document.getElementById('item-id').value = '';

        const statusGroup = document.getElementById('status-group');
        if (statusGroup) statusGroup.style.display = 'none';
        document.getElementById('status').value = '募集中';
        document.getElementById('author').value = '';
        document.getElementById('board-comment').value = '';
    }

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function closeModal() {
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 350);
}

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const idInput = document.getElementById('item-id').value;
    const status = document.getElementById('status').value;
    const author = document.getElementById('author').value.trim();
    const artist = document.getElementById('artist').value;
    const song = document.getElementById('song').value;
    const comment = document.getElementById('board-comment').value.trim();

    const parts = [];
    const partCounts = {};

    document.querySelectorAll('input[type="checkbox"][name="part"]:checked').forEach(cb => {
        const partName = cb.value;
        const numInput = document.querySelector(`input[name="part_count_${partName}"]`);
        const countVal = numInput ? (parseInt(numInput.value) || 1) : 1;

        if (partName) {
            parts.push(partName);
            partCounts[partName] = countVal;
        }
    });

    document.querySelectorAll('.custom-part-row').forEach(row => {
        const partName = row.querySelector('.custom-part-name').value.trim();
        const countVal = parseInt(row.querySelector('.custom-part-num').value) || 1;

        if (partName) {
            if (parts.includes(partName)) {
                partCounts[partName] += countVal;
            } else {
                parts.push(partName);
                partCounts[partName] = countVal;
            }
        }
    });

    const newData = {
        status,
        author,
        artist,
        song,
        comment,
        parts,
        partCounts
    };

    if (idInput) {
        const index = items.findIndex(i => i.id == idInput);
        if (index > -1) {
            items[index] = { ...items[index], ...newData };
            if (checkAllFilled(items[index])) {
                items[index].status = '締め切り';
            } else {
                items[index].status = '募集中';
            }
        }
    } else {
        newData.id = Date.now().toString();
        newData.candidates = {};
        items.push(newData);
    }

    saveItems();
    closeModal();

    if (!detailModal.classList.contains('hidden') && idInput) {
        openDetailModal(idInput);
    }
});

function deleteItem(id) {
    if (confirm('本当にこの募集を削除しますか？\n（※通信を伴うため数秒かかります）')) {
        items = items.filter(i => i.id != id);
        saveItems();
        if (!detailModal.classList.contains('hidden') && detailContent.innerHTML.includes(id)) {
            closeDetailModal();
        }
    }
}

// 既存モーダルイベントリスナー登録
addBtn.addEventListener('click', () => openModal());
cancelBtn.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});


// HTMLエスケープ処理（XSS対策）
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// 初期化実行
init();
