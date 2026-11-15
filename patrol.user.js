// ==UserScript==
// @name         патрули отчеты
// @namespace    http://tampermonkey.net/
// @version      01
// @description  отчетник патруль
// @author       мивка смотрела дипсик работал
// @match        https://catwar.su/blog5287
// @match        https://catwar.net/blog5287
// @icon         https://www.google.com/s2/favicons?sz=64&domain=catwar.net
// @grant        none
// @updateURL    https://github.com/elizavetaolemskaa-sketch/patroolchik/raw/refs/heads/main/patrol.user.js
// @downloadURL  https://github.com/elizavetaolemskaa-sketch/patroolchik/raw/refs/heads/main/patrol.user.js
// ==/UserScript==

(function() {
    'use strict';

    const COLORS = {
        bgMain: '#f2ead0a5',
        bgTabActive: '#677355e5',
        textDark: '#000000',
        border: '#043005',
        warning: '#8B0000',
        success: '#000000',
        correction: '#000000'
    };
    const FONT_FAMILY = 'Georgia, serif';

    function getTodayISO() {
        return new Date().toISOString().split('T')[0];
    }

    function formatDateForReport(isoDate) {
        if (!isoDate) return '';
        const parts = isoDate.split('-');
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    async function convertNameToId(name) {
        if (!name || !name.trim()) return '';
        if (name.match(/^\d+$/)) return name;

        const formattedName = name.split(' ').map(word => {
            if (word.length === 0) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');

        try {
            const response = await fetch('/ajax/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    data: formattedName,
                    delimiter: ',',
                    template: '[link%id%]',
                    type_in: '0',
                    type_out: '0'
                })
            });
            const result = await response.text();
            const match = result.match(/\[link(\d+)\]/);
            return match ? match[1] : '';
        } catch (e) {
            console.error('Ошибка при конвертации имени:', e);
            return '';
        }
    }

    // имя по ID через страницу профиля /cat{id}
    async function convertIdToName(id) {
        if (!id || !/^\d+$/.test(id)) return '';

        try {
            const resp = await fetch(`/cat${id}`);
            if (!resp.ok) return '';

            const html = await resp.text();
            const titleMatch = html.match(/<title>Профиль игрока\s+(.+?)\s*\/\s*CatWar<\/title>/i);

            if (titleMatch && titleMatch[1]) {
                const name = titleMatch[1].trim();
                if (name && name !== id && !/^\d+$/.test(name)) {
                    return name;
                }
            }
        } catch (e) {
            console.error('Ошибка при получении имени по ID:', e);
        }

        return '';
    }

    // Разбор одиночной записи "Имя [ID]", "Имя" или "ID".
    // Возвращает { name, id } или null, если имя не найдено и ID не был указан.
    async function resolveSinglePerson(raw, corrections, label) {
        const trimmed = raw.trim();
        if (!trimmed) return null;

        // "Имя [ID]"
        const m = trimmed.match(/^(.+?)\s*\[(\d+)\]$/);
        if (m) {
            const name = m[1].trim();
            const providedId = m[2];
            const actualId = await convertNameToId(name);
            if (actualId) {
                if (actualId !== providedId) {
                    corrections.push(`${label}: ${name} [${providedId}] → [${actualId}]`);
                }
                return { name, id: actualId };
            }
            console.warn(`Не удалось проверить ID "${label}" ${name}, оставлен исходный [${providedId}]`);
            return { name, id: providedId };
        }

        // Только ID
        if (/^\d+$/.test(trimmed)) {
            const id = trimmed;
            const name = await convertIdToName(id);
            if (name) return { name, id };
            return { name: id, id, unresolvedName: true };
        }

        // Только имя
        const id = await convertNameToId(trimmed);
        if (id) return { name: trimmed, id };
        return null;
    }

    // Форматирование человека для отчёта: "Имя [ID]" или "[ID]", если имя не получено.
    function formatPersonForReport(person) {
        if (person.unresolvedName || person.name === person.id) {
            return `[${person.id}]`;
        }
        return `${person.name} [${person.id}]`;
    }

    function createReportForm() {
        const div = document.createElement('div');
        div.style.marginBottom = '15px';
        div.style.padding = '10px';
        div.style.backgroundColor = COLORS.bgMain;
        div.style.border = '1px solid ' + COLORS.border;
        div.style.fontFamily = FONT_FAMILY;

        const possibleTimes = ['12:00', '14:00', '16:00', '17:00', '18:30', '21:00'];

        div.innerHTML = `
            <div style="background-color: ${COLORS.bgTabActive}; padding: 4px; margin-bottom: 10px; font-weight: bold; text-align: center; color: ${COLORS.textDark};">Формирование отчёта</div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px; align-items: center; font-size: 13px;">
                <span>Время сбора:</span>
                <select id="report_time" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY};">
                    ${possibleTimes.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>

                <span>Дата сбора:</span>
                <input type="date" id="report_date" value="${getTodayISO()}" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY};">

                <span>Собирающий (имя/ID):</span>
                <input type="text" id="report_gatherer" placeholder="Имя или ID" value="" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY};">

                <span>Ведущий (имя/ID):</span>
                <input type="text" id="report_leader" placeholder="Имя или ID" value="" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY};">

                <span>Ходили (имена через запятую):</span>
                <textarea id="report_members" placeholder="Имя1, Имя2, Имя3" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY}; height: 60px;"></textarea>
            </div>
            <div id="report_warning" style="color: ${COLORS.warning}; font-size: 12px; margin-top: 8px; text-align: center; display: none;"></div>
            <button id="report_submit" style="width:100%; margin-top:10px; padding:6px; background:${COLORS.bgTabActive}; color:${COLORS.textDark}; border:none; cursor:pointer; font-family:${FONT_FAMILY}; font-weight:bold;">Сформировать отчёт</button>
        `;

        const warningDiv = div.querySelector('#report_warning');
        const gathererInput = div.querySelector('#report_gatherer');
        const leaderInput = div.querySelector('#report_leader');
        const membersTextarea = div.querySelector('#report_members');

        div.querySelector('#report_submit').onclick = async (e) => {
            e.preventDefault();
            warningDiv.style.display = 'none';
            warningDiv.style.color = COLORS.warning;

            const time = div.querySelector('#report_time').value;
            const dateISO = div.querySelector('#report_date').value.trim();
            if (!dateISO) {
                warningDiv.textContent = 'Укажите дату';
                warningDiv.style.display = 'block';
                return;
            }
            const date = formatDateForReport(dateISO);

            const gathererRaw = gathererInput.value.trim();
            const leaderRaw = leaderInput.value.trim();
            const membersRaw = membersTextarea.value.trim();

            if (!gathererRaw) {
                warningDiv.textContent = 'Укажите собирающего';
                warningDiv.style.display = 'block';
                return;
            }
            if (!leaderRaw) {
                warningDiv.textContent = 'Укажите ведущего';
                warningDiv.style.display = 'block';
                return;
            }
            if (!membersRaw) {
                warningDiv.textContent = 'Укажите участников';
                warningDiv.style.display = 'block';
                return;
            }

            const corrections = [];

            // 1. Собирающий — перепроверяем ID
            const gatherer = await resolveSinglePerson(gathererRaw, corrections, 'Собирающий');
            if (!gatherer) {
                warningDiv.textContent = `⚠️ Игрок "${gathererRaw}" не найден. Проверьте имя.`;
                warningDiv.style.display = 'block';
                return;
            }
            if (gatherer.name !== gatherer.id) {
                gathererInput.value = `${gatherer.name} [${gatherer.id}]`;
            }

            // 2. Ведущий — перепроверяем ID
            const leader = await resolveSinglePerson(leaderRaw, corrections, 'Ведущий');
            if (!leader) {
                warningDiv.textContent = `⚠️ Игрок "${leaderRaw}" не найден. Проверьте имя.`;
                warningDiv.style.display = 'block';
                return;
            }
            if (leader.name !== leader.id) {
                leaderInput.value = `${leader.name} [${leader.id}]`;
            }

            // 3. Разбираем список участников
            const membersList = membersRaw.split(',').map(m => m.trim()).filter(m => m.length > 0);

            // 4. Сначала разрешаем всех участников (ID перепроверяются).
            const resolvedMembers = [];
            for (const member of membersList) {
                const resolved = await resolveSinglePerson(member, corrections, 'Участник');
                if (!resolved) {
                    warningDiv.textContent = `⚠️ Игрок "${member}" не найден в системе! Проверьте имя.`;
                    warningDiv.style.display = 'block';
                    return;
                }
                resolvedMembers.push(resolved);
            }

            // 5. Теперь добавляем ведущего, если его нет.
            //    Сравниваем по уже перепроверенным ID — дубликат по ID невозможен.
            //    Собирающий в "Ходили" не добавляется автоматически ! ! !
            if (!resolvedMembers.some(p => p.id === leader.id)) {
                resolvedMembers.push(leader);
            }

            // 6. Минимум 3 УНИКАЛЬНЫХ участника (считаем после дедупликации)
            if (resolvedMembers.length < 3) {
                warningDiv.textContent = '⚠️ В патруле должны участвовать от 3ёх котов!';
                warningDiv.style.display = 'block';
                return;
            }

            // 7. Форматируем участников
            const membersFormatted = resolvedMembers.map(formatPersonForReport);

            // 8. Собираем отчёт
            let reportText = `[b]${time}, ${date}.\n`;
            reportText += `Собирающий:[/b] ${formatPersonForReport(gatherer)}\n`;
            reportText += `[b]Ведущий:[/b] ${formatPersonForReport(leader)}\n`;
            reportText += `[b]Ходили:[/b] ${membersFormatted.join(', ')}`;

            // 9. Вставляем в поле комментария
            const field = document.querySelector('#comment');
            if (!field) {
                warningDiv.textContent = 'Поле ввода не найдено. Проверьте селектор.';
                warningDiv.style.display = 'block';
                return;
            }
            field.value = reportText;

            // 10. Заметки: коррекции  + инфо о нераспознанных ID
            const notices = [];
            if (corrections.length > 0) {
                notices.push(` ID скорректированы: ${corrections.join('; ')}`);
            }
            if (gatherer.unresolvedName) {
                notices.push(`ℹ️ Имя по ID собирающего не получено, в отчёте будет [${gatherer.id}].`);
            }
            if (leader.unresolvedName) {
                notices.push(`ℹ️ Имя по ID ведущего не получено, в отчёте будет [${leader.id}].`);
            }
            if (notices.length > 0) {
                warningDiv.style.color = corrections.length > 0 ? COLORS.correction : COLORS.textDark;
                warningDiv.textContent = notices.join(' ');
                warningDiv.style.display = 'block';
            }
        };

        return div;
    }

    function addBackgroundStyle() {
        const style = document.createElement('style');
        style.textContent = `
            #report-helper-panel {
                background-image: url('https://e.radikal.host/2026/06/20/2024-09-23-100607048.png');
                background-repeat: repeat;
                background-position: top left;
            }
        `;
        document.head.appendChild(style);
    }

    function createMainPanel() {
        const panel = document.createElement('div');
        panel.id = 'report-helper-panel';
        panel.style.cssText = `border: 1px solid ${COLORS.border}; margin: 20px 0 10px 0; padding: 10px; font-family: ${FONT_FAMILY}; color: ${COLORS.textDark};`;

        panel.innerHTML = `
            <div class="panel-header" style="background-color: ${COLORS.bgTabActive}; padding: 8px 12px; margin: -10px -10px 10px -10px; font-size: 18px; font-weight: bold; text-align: center; color: ${COLORS.textDark};">Отчёт патруля</div>
            <div class="panel-content"></div>
        `;

        const content = panel.querySelector('.panel-content');
        content.appendChild(createReportForm());

        return panel;
    }

    function insertPanel() {
        const panel = createMainPanel();

        const sendButton = document.querySelector('#send_comment');
        if (sendButton) {
            sendButton.parentNode.insertBefore(panel, sendButton.nextSibling);
            console.log('✅ Панель вставлена после #send_comment');
            return;
        }

        const form = document.querySelector('form');
        if (form) {
            form.parentNode.insertBefore(panel, form.nextSibling);
            console.log('✅ Панель вставлена после формы');
            return;
        }

        document.body.appendChild(panel);
        console.log('✅ Панель вставлена в конец body (запасной вариант)');
    }

    addBackgroundStyle();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', insertPanel);
    } else {
        insertPanel();
    }
})();
