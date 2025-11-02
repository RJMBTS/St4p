// Stalker-Portal To M3U Generator Script (Cloudflare Compatible)
// Original: Kittujk
const config = {
    host: '234981.cc', // Stalker-Portal host (no /stalker_portal/c/ here)
    mac_address: '00:1A:79:00:00:20',
    serial_number: '2BB69E326F44A',
    device_id: '429F9A215C0194B76F3F1E598658B1E4A6DE5749BF7BD9D0ED602DDAE93531E5',
    device_id_2: '429F9A215C0194B76F3F1E598658B1E4A6DE5749BF7BD9D0ED602DDAE93531E5',
    stb_type: 'MAG250',
    api_signature: '263',
};

// ---------- Helper Functions ----------
async function generateHardwareVersions() {
    const macHash = await hash(config.mac_address);
    config.hw_version = '1.7-BD-' + macHash.substring(0, 2).toUpperCase();
    config.hw_version_2 = await hash(config.serial_number.toLowerCase() + config.mac_address.toLowerCase());
}

async function hash(str) {
    const data = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', data); // ✅ SHA-256 (supported by Cloudflare)
    return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
}

function safeParseJSON(text) {
    try {
        return JSON.parse(text);
    } catch (err) {
        console.error("❌ JSON parse error:", err, text);
        return {};
    }
}

function getHeaders(token = '') {
    const headers = {
        'Cookie': `mac=${config.mac_address}; stb_lang=en; timezone=GMT`,
        'Referer': `http://${config.host}/stalker_portal/c/`,
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        'X-User-Agent': `Model: ${config.stb_type}; Link: WiFi`
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// ---------- Portal Functions ----------
async function getToken() {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    try {
        const res = await fetch(url, { headers: getHeaders() });
        const data = safeParseJSON(await res.text());
        return data.js?.token || '';
    } catch (e) {
        console.error("getToken() error:", e);
        return '';
    }
}

async function auth(token) {
    const metrics = encodeURIComponent(JSON.stringify({
        mac: config.mac_address, model: '', type: 'STB', uid: '', device: '', random: ''
    }));
    const url = `http://${config.host}/stalker_portal/server/load.php?type=stb&action=get_profile`
        + `&hd=1&ver=ImageDescription:%200.2.18-r14-pub-250; PORTAL version:%205.5.0; API Version:%20328;`
        + `&num_banks=2&sn=${config.serial_number}&stb_type=${config.stb_type}&client_type=STB&image_version=218`
        + `&video_out=hdmi&device_id=${config.device_id}&device_id2=${config.device_id_2}`
        + `&signature=&auth_second_step=1&hw_version=${config.hw_version}`
        + `&not_valid_token=0&metrics=${metrics}&hw_version_2=${config.hw_version_2}`
        + `&api_signature=${config.api_signature}&prehash=&JsHttpRequest=1-xml`;

    try {
        const res = await fetch(url, { headers: getHeaders(token) });
        const data = safeParseJSON(await res.text());
        return data.js || [];
    } catch (e) {
        console.error("auth() error:", e);
        return [];
    }
}

async function handShake(token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=stb&action=handshake&token=${token}&JsHttpRequest=1-xml`;
    try {
        const res = await fetch(url, { headers: getHeaders() });
        const data = safeParseJSON(await res.text());
        return data.js?.token || '';
    } catch (e) {
        console.error("handShake() error:", e);
        return '';
    }
}

async function getAccountInfo(token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=account_info&action=get_main_info&JsHttpRequest=1-xml`;
    try {
        const res = await fetch(url, { headers: getHeaders(token) });
        const data = safeParseJSON(await res.text());
        return data.js || [];
    } catch (e) {
        console.error("getAccountInfo() error:", e);
        return [];
    }
}

async function getGenres(token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
    try {
        const res = await fetch(url, { headers: getHeaders(token) });
        const data = safeParseJSON(await res.text());
        return data.js || [];
    } catch (e) {
        console.error("getGenres() error:", e);
        return [];
    }
}

async function getStreamURL(id, token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt%20http://localhost/ch/${id}&JsHttpRequest=1-xml`;
    try {
        const res = await fetch(url, { headers: getHeaders(token) });
        const data = safeParseJSON(await res.text());
        return data.js?.cmd || '';
    } catch (e) {
        console.error("getStreamURL() error:", e);
        return '';
    }
}

// ---------- Main Logic ----------
async function genToken() {
    await generateHardwareVersions();
    const token = await getToken();
    if (!token) return { token: '', profile: [], account_info: [] };

    const profile = await auth(token);
    const newToken = await handShake(token);
    const account_info = newToken ? await getAccountInfo(newToken) : [];

    return { token: newToken || token, profile, account_info };
}

async function convertJsonToM3U(channels, profile, account_info, request) {
    let m3u = [`#EXTM3U`, `# Total Channels => ${channels.length}`, ''];
    const origin = new URL(request.url).origin;

    for (const ch of channels) {
        const id = ch.cmd?.replace('ffrt http://localhost/ch/', '') || 'unknown';
        const logo_url = ch.logo ? `http://${config.host}/stalker_portal/misc/logos/320/${ch.logo}` : '';
        m3u.push(`#EXTINF:-1 tvg-id="${ch.tvgid}" tvg-name="${ch.name}" tvg-logo="${logo_url}" group-title="${ch.title}",${ch.name}`);
        m3u.push(`${origin}/${id}.m3u8`);
    }

    return m3u.join('\n');
}

// ---------- Request Handler ----------
async function handleRequest(request) {
    try {
        const url = new URL(request.url);
        const path = url.pathname;

        const { token, profile, account_info } = await genToken();
        if (!token) return new Response('❌ Token generation failed', { status: 500 });

        if (path === '/playlist.m3u8') {
            const res = await fetch(`http://${config.host}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`, { headers: getHeaders(token) });
            const data = safeParseJSON(await res.text());
            const genres = await getGenres(token);

            let channels = data.js?.data?.map(item => ({
                name: item.name || 'Unknown',
                cmd: item.cmd || '',
                tvgid: item.xmltv_id || '',
                id: item.tv_genre_id || '',
                logo: item.logo || ''
            })) || [];

            const genreMap = {};
            genres.forEach(g => genreMap[g.id] = g.title || 'Other');
            channels = channels.map(ch => ({ ...ch, title: genreMap[ch.id] || 'Other' }));

            const m3u = await convertJsonToM3U(channels, profile, account_info, request);
            return new Response(m3u, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
        }

        if (path.endsWith('.m3u8') && path !== '/playlist.m3u8') {
            const id = path.replace('/', '').replace('.m3u8', '');
            const stream = await getStreamURL(id, token);
            if (!stream) return new Response('❌ No stream URL found', { status: 500 });
            return Response.redirect(stream, 302);
        }

        return new Response('🌐 Worker is running. Use /playlist.m3u8', { status: 200 });

    } catch (err) {
        console.error("Global error:", err);
        return new Response('❌ Internal Worker error: ' + err.message, { status: 500 });
    }
}

// ---------- Cloudflare Export ----------
export default { fetch: handleRequest };
