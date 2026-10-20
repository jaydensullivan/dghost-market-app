// DGhost Trade — работает только на странице нового обмена Steam,
// открытой из мини-аппа DGhostMarket (в ссылке есть dghost_asset).
// Находит проданный предмет в инвентаре продавца и по нажатию кнопки
// отправляет обмен покупателю. Сам ничего не отправляет: ссылку может
// подделать кто угодно, поэтому продавец видит предмет и получателя
// и подтверждает сам — а потом ещё раз в Steam Guard.

(() => {
  const STEAM_ID64_BASE = 76561197960265728n;
  const params = new URL(location.href).searchParams;
  const assetId = params.get('dghost_asset') || '';
  const dealId = params.get('dghost_deal') || '';
  const partner = params.get('partner') || '';
  const token = params.get('token') || '';

  if (!/^\d{1,20}$/.test(assetId) || !/^\d{1,10}$/.test(partner)) return;

  const html = document.documentElement.innerHTML;
  const pick = (re) => { const m = html.match(re); return m ? m[1] : ''; };

  const mySteamId = pick(/g_steamID\s*=\s*"(\d{17})"/);
  const sessionId = (document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/) || [])[1]
    || pick(/g_sessionID\s*=\s*"([^"]+)"/);
  const partnerName = pick(/g_strTradePartnerPersonaName\s*=\s*"((?:[^"\\]|\\.)*)"/)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(.)/g, '$1');
  const partnerId64 = (BigInt(partner) + STEAM_ID64_BASE).toString();

  // ---------- панель ----------
  const panel = document.createElement('div');
  panel.className = 'dghost-panel';
  panel.innerHTML = `
    <div class="dghost-head">DGhost Trade</div>
    <div class="dghost-item">
      <img class="dghost-img" alt="" hidden>
      <div>
        <div class="dghost-name">Ищу предмет в инвентаре…</div>
        <div class="dghost-to"></div>
      </div>
    </div>
    <div class="dghost-status"></div>
    <button type="button" class="dghost-send" disabled>Отправить обмен</button>
  `;
  document.body.appendChild(panel);

  const $ = (sel) => panel.querySelector(sel);
  const status = (text, kind) => {
    $('.dghost-status').textContent = text;
    $('.dghost-status').dataset.kind = kind || '';
  };
  $('.dghost-to').textContent = 'Покупатель: ' + (partnerName || partnerId64);

  if (!mySteamId || !sessionId) {
    $('.dghost-name').textContent = 'Войдите в Steam в этом браузере';
    status('После входа откройте ссылку из мини-аппа ещё раз.', 'error');
    return;
  }

  async function findItem() {
    let start = '';
    for (let page = 0; page < 5; page++) {
      const url = `/inventory/${mySteamId}/730/2?l=russian&count=1000${start ? '&start_assetid=' + start : ''}`;
      const r = await fetch(url, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('inventory ' + r.status);
      const data = await r.json();
      const asset = (data.assets || []).find(a => a.assetid === assetId);
      if (asset) {
        return (data.descriptions || []).find(d =>
          d.classid === asset.classid && d.instanceid === asset.instanceid) || {};
      }
      if (!data.more_items || !data.last_assetid) return null;
      start = data.last_assetid;
    }
    return null;
  }

  async function send() {
    const btn = $('.dghost-send');
    btn.disabled = true;
    status('Отправляю…');
    const offer = {
      newversion: true,
      version: 2,
      me: { assets: [{ appid: 730, contextid: '2', amount: 1, assetid: assetId }], currency: [], ready: false },
      them: { assets: [], currency: [], ready: false },
    };
    const body = new URLSearchParams({
      sessionid: sessionId,
      serverid: '1',
      partner: partnerId64,
      tradeoffermessage: dealId ? `DGhostMarket, сделка #${dealId}` : 'DGhostMarket',
      json_tradeoffer: JSON.stringify(offer),
      captcha: '',
      trade_offer_create_params: JSON.stringify(token ? { trade_offer_access_token: token } : {}),
    });
    try {
      const r = await fetch('/tradeoffer/new/send', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.tradeofferid) {
        throw new Error(data.strError || ('Steam ответил ошибкой ' + r.status));
      }
      btn.hidden = true;
      status(
        `✅ Обмен создан. Подтвердите его в Steam Guard на телефоне, затем вернитесь в Telegram и нажмите «Отправил».`,
        'ok'
      );
    } catch (e) {
      btn.disabled = false;
      status('Не получилось: ' + e.message + '. Можно выбрать предмет вручную на этой странице.', 'error');
    }
  }

  $('.dghost-send').addEventListener('click', send);

  findItem()
    .then(desc => {
      if (!desc) {
        $('.dghost-name').textContent = 'Предмета нет в вашем инвентаре';
        status('Проверьте, что вошли в тот Steam-аккаунт, с которого продавали.', 'error');
        return;
      }
      $('.dghost-name').textContent = desc.market_name || desc.name || ('Предмет #' + assetId);
      if (desc.icon_url) {
        const img = $('.dghost-img');
        img.src = `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}/96fx96f`;
        img.hidden = false;
      }
      if (desc.tradable === 0) {
        status('Steam пока не даёт передать этот предмет (ограничение на обмен).', 'error');
        return;
      }
      $('.dghost-send').disabled = false;
    })
    .catch(() => {
      // Инвентарь не загрузился (Steam иногда ограничивает частоту
      // запросов) — отправить всё равно можно, Steam сам проверит предмет.
      $('.dghost-name').textContent = 'Предмет #' + assetId;
      status('Не удалось загрузить инвентарь — проверьте предмет в окне подтверждения Steam Guard.');
      $('.dghost-send').disabled = false;
    });
})();
