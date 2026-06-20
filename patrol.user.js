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
        success: '#000000'
    };
    const FONT_FAMILY = 'Georgia, serif';


    let userData = {
        name: localStorage.getItem('report_user_name') || '',
        id: localStorage.getItem('report_user_id') || ''
    };

    function saveUserData() {
        localStorage.setItem('report_user_name', userData.name);
        localStorage.setItem('report_user_id', userData.id);
    }


    function getCurrentDate() {
        const d = new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
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

    // панель
    function createUserPanel() {
        const panel = document.createElement('div');
        panel.style.cssText = `background-color: ${COLORS.bgMain}; border: 1px solid ${COLORS.border}; margin: 10px 0; padding: 10px; font-family: ${FONT_FAMILY}; color: ${COLORS.textDark};`;
        panel.innerHTML = `
            <div style="background-color: ${COLORS.bgTabActive}; padding: 6px 10px; margin: -10px -10px 10px -10px; font-size: 14px; font-weight: bold; text-align: center; color: ${COLORS.textDark};">Мои данные</div>
            <div style="display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: center; font-size: 13px;">
                <span>Имя:</span>
                <input type="text" id="report_user_name" placeholder="Ваше имя" value="${userData.name}" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY};">
                <span>ID:</span>
                <input type="text" id="report_user_id" placeholder="Ваш ID" value="${userData.id}" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY};">
            </div>
            <div id="save_status" style="font-size: 11px; margin-top: 5px; text-align: center; color: ${COLORS.success}; display: none;"></div>
            <button id="save_user_btn" style="width: 100%; margin-top: 10px; padding: 5px; background: ${COLORS.bgTabActive}; color: ${COLORS.textDark}; border: none; cursor: pointer; font-family: ${FONT_FAMILY}; font-weight: bold;">Сохранить</button>
        `;

        const saveBtn = panel.querySelector('#save_user_btn');
        const nameInput = panel.querySelector('#report_user_name');
        const idInput = panel.querySelector('#report_user_id');
        const statusDiv = panel.querySelector('#save_status');

        saveBtn.onclick = async (e) => {
            e.preventDefault();
            let name = nameInput.value.trim();
            let id = idInput.value.trim();

            if (!name && !id) {
                statusDiv.textContent = 'Заполните хотя бы одно поле (имя или ID)';
                statusDiv.style.color = COLORS.warning;
                statusDiv.style.display = 'block';
                return;
            }

            if (name && !id) {
                statusDiv.textContent = 'Ищу ID по имени...';
                statusDiv.style.display = 'block';
                const convertedId = await convertNameToId(name);
                if (convertedId) {
                    id = convertedId;
                    idInput.value = id;
                    statusDiv.textContent = 'ID найден!';
                    statusDiv.style.color = COLORS.success;
                } else {
                    statusDiv.textContent = 'Не удалось найти ID. Проверьте имя.';
                    statusDiv.style.color = COLORS.warning;
                    return;
                }
            }

            userData.name = name;
            userData.id = id;
            saveUserData();

            statusDiv.textContent = 'Данные сохранены!';
            statusDiv.style.color = COLORS.success;
            statusDiv.style.display = 'block';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 1500);
            saveBtn.textContent = 'Сохранено!';
            setTimeout(() => { saveBtn.textContent = 'Сохранить'; }, 1500);
        };

        return panel;
    }

    // форма отчета
    function createReportForm() {
        const div = document.createElement('div');
        div.style.marginBottom = '15px';
        div.style.padding = '10px';
        div.style.backgroundColor = COLORS.bgMain;
        div.style.border = '1px solid ' + COLORS.border;
        div.style.fontFamily = FONT_FAMILY;

        const currentDate = getCurrentDate();
        const possibleTimes = ['12:00', '14:00', '16:00', '17:00', '18:30', '21:00'];

        div.innerHTML = `
            <div style="background-color: ${COLORS.bgTabActive}; padding: 4px; margin-bottom: 10px; font-weight: bold; text-align: center; color: ${COLORS.textDark};">Формирование отчёта</div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px; align-items: center; font-size: 13px;">
                <span>Время сбора:</span>
                <select id="report_time" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY};">
                    ${possibleTimes.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>

                <span>Дата сбора:</span>
                <input type="text" id="report_date" placeholder="дд.мм.гггг" value="${currentDate}" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY};">

                <span>Я был ведущим?</span>
                <input type="checkbox" id="report_is_leader" style="width: auto;">

                <span>Ведущий (имя/ID):</span>
                <input type="text" id="report_leader" placeholder="Имя или ID" value="" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY};">

                <span>Ходили (имена через запятую):</span>
                <textarea id="report_members" placeholder="Имя1, Имя2, Имя3" style="width: 100%; padding: 4px; font-family: ${FONT_FAMILY}; height: 60px;"></textarea>
            </div>
            <div id="report_warning" style="color: ${COLORS.warning}; font-size: 12px; margin-top: 8px; text-align: center; display: none;"></div>
            <button id="report_submit" style="width:100%; margin-top:10px; padding:6px; background:${COLORS.bgTabActive}; color:${COLORS.textDark}; border:none; cursor:pointer; font-family:${FONT_FAMILY}; font-weight:bold;">Сформировать отчёт</button>
        `;

        const warningDiv = div.querySelector('#report_warning');
        const leaderInput = div.querySelector('#report_leader');
        const isLeaderCheckbox = div.querySelector('#report_is_leader');
        const membersTextarea = div.querySelector('#report_members');

        isLeaderCheckbox.addEventListener('change', function() {
            if (this.checked) {
                if (userData.name && userData.id) {
                    leaderInput.value = `${userData.name} [${userData.id}]`;
                } else if (userData.name) {
                    leaderInput.value = userData.name;
                } else {
                    leaderInput.value = '';
                }
                leaderInput.disabled = true;
            } else {
                leaderInput.disabled = false;
                leaderInput.value = '';
            }
        });

        div.querySelector('#report_submit').onclick = async (e) => {
            e.preventDefault();

            const time = div.querySelector('#report_time').value;
            const date = div.querySelector('#report_date').value.trim();
            let leader = leaderInput.value.trim();
            const membersRaw = membersTextarea.value.trim();

            // Проверка обязательных полей
            if (!date) {
                warningDiv.textContent = 'Укажите дату';
                warningDiv.style.display = 'block';
                return;
            }
            if (!leader) {
                warningDiv.textContent = 'Укажите ведущего (или поставьте галочку "Я был ведущим")';
                warningDiv.style.display = 'block';
                return;
            }
            if (!membersRaw) {
                warningDiv.textContent = 'Укажите участников';
                warningDiv.style.display = 'block';
                return;
            }
            warningDiv.style.display = 'none';

           // 1. Проверяем ведущего: если у него нет ID в скобках – ищем через API
            let leaderId = '';
            let leaderNameOnly = leader;
            const leaderIdMatch = leader.match(/^(.+?)\s*\[(\d+)\]$/);
            if (leaderIdMatch) {
                leaderNameOnly = leaderIdMatch[1].trim();
                leaderId = leaderIdMatch[2];
            } else {
                // Пытаемся найти ID по имени
                const foundId = await convertNameToId(leader);
                if (foundId) {
                    leaderId = foundId;
                    leaderNameOnly = leader;
                } else {
                    // Не найден – выдаём ошибку
                    warningDiv.textContent = `⚠️ Игрок "${leader}" не найден! Проверьте имя.`;
                    warningDiv.style.color = COLORS.warning;
                    warningDiv.style.display = 'block';
                    return;
                }
            }
            // Форматируем ведущего для вывода
            const leaderFormatted = `${leaderNameOnly} [${leaderId}]`;

            // 2. Разбираем список участников (без ID)
            let membersList = membersRaw.split(',').map(m => m.trim()).filter(m => m.length > 0);

            // 3. Добавляем ведущего в список, если его там нет (по имени без ID)
            const leaderLower = leaderNameOnly.toLowerCase();
            const hasLeader = membersList.some(m => m.toLowerCase().includes(leaderLower));
            if (!hasLeader) {
                membersList.push(leaderNameOnly);
            }

            // 4. Проверка на минимальное количество участников (>=3)
            if (membersList.length < 3) {
                warningDiv.textContent = '⚠️ В патруле должны участвовать от 3ёх котов!';
                warningDiv.style.color = COLORS.warning;
                warningDiv.style.display = 'block';
                return;
            }

            // 5. Для каждого участника проверяем наличие ID и формируем список с ID
            const membersFormatted = [];
            for (const member of membersList) {
                let memberName = member;
                let memberId = '';
                // Если уже есть ID в скобках – извлекаем
                const idMatch = member.match(/^(.+?)\s*\[(\d+)\]$/);
                if (idMatch) {
                    memberName = idMatch[1].trim();
                    memberId = idMatch[2];
                } else {
                    // Пытаемся найти ID
                    const foundId = await convertNameToId(member);
                    if (foundId) {
                        memberId = foundId;
                        memberName = member;
                    } else {
                        // Не найден – выдаём ошибку и прерываем
                        warningDiv.textContent = `⚠️ Игрок "${member}" не найден! Проверьте имя.`;
                        warningDiv.style.color = COLORS.warning;
                        warningDiv.style.display = 'block';
                        return;
                    }
                }
                membersFormatted.push(`${memberName} [${memberId}]`);
            }

            // 6. Собираем отчёт
            let reportText = `${time}, ${date}.\n`;
            reportText += `Ведущий: ${leaderFormatted}\n`;
            reportText += `Ходили: ${membersFormatted.join(', ')}`;

            // 7. Вставляем в поле комментария
            const field = document.querySelector('#comment');
            if (field) {
                field.value = reportText;
            } else {
                warningDiv.textContent = 'Поле ввода не найдено. Проверьте селектор.';
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
        content.appendChild(createUserPanel());
        content.appendChild(createReportForm());

        return panel;
    }

    // вставка
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
