// Stalker-Portal To M3U Generator Script
// Scripted by : Kittujk

// ============ ⚙ CONFIGURATION ============
const config = {
    host: 'tv.stream4k.cc', // Stalker-Portal host (no /stalker_portal/c/ here)
    mac_address: '00:1A:79:00:01:B2',
    serial_number: 'F1F01D055C112',
    device_id: '48660C2F0697446BA49440761C73E6CB98494D5FFA04D3F7C5EC7652016572FE',
    device_id_2: '48660C2F0697446BA49440761C73E6CB98494D5FFA04D3F7C5EC7652016572FE',
    stb_type: 'MAG250',
    api_signature: '263',
};

// Auto-generate hw_version & hw_version_2
async function generateHardwareVersions() {
    config.hw_version = '1.7-BD-' + (await hash(config.mac_address)).substring(0, 2).toUpperCase();
    config.hw_version_2 = await hash(config.serial_number.toLowerCase() + config.mac_address.toLowerCase());
}

async function hash(str) {
    const data = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('MD5', data);
    return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
}

function getHeaders(token = '') {
    const headers = {
        'Cookie': `mac=${config.mac_address}; stb_lang=en; timezone=GMT`,
        'Referer': `http://${config.host}/stalker_portal/c/`,
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        'X-User-Agent': `Model: ${config.stb_type}; Link: WiFi`
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function getToken() {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) return '';
    const text = await response.text();
    const data = JSON.parse(text);
    return data.js?.token || '';
}

async function auth(token) {
    const metrics = {
        mac: config.mac_address,
        model: '',
        type: 'STB',
        uid: '',
        device: '',
        random: ''
    };
    const metricsEncoded = encodeURIComponent(JSON.stringify(metrics));

    const url = `http://${config.host}/stalker_portal/server/load.php?type=stb&action=get_profile`
        + `&hd=1&ver=ImageDescription:%200.2.18-r14-pub-250;`
        + `%20PORTAL%20version:%205.5.0;%20API%20Version:%20328;`
        + `&num_banks=2&sn=${config.serial_number}`
        + `&stb_type=${config.stb_type}&client_type=STB&image_version=218&video_out=hdmi`
        + `&device_id=${config.device_id}&device_id2=${config.device_id_2}`
        + `&signature=&auth_second_step=1&hw_version=${config.hw_version}`
        + `&not_valid_token=0&metrics=${metricsEncoded}`
        + `&hw_version_2=${config.hw_version_2}&api_signature=${config.api_signature}`
        + `&prehash=&JsHttpRequest=1-xml`;

    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) return [];
    const text = await response.text();
    const data = JSON.parse(text);
    return data.js || [];
}

async function handShake(token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=stb&action=handshake&token=${token}&JsHttpRequest=1-xml`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) return '';
    const text = await response.text();
    const data = JSON.parse(text);
    return data.js?.token || '';
}

async function getAccountInfo(token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=account_info&action=get_main_info&JsHttpRequest=1-xml`;
    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) return [];
    const text = await response.text();
    const data = JSON.parse(text);
    return data.js || [];
}

async function getGenres(token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) return [];
    const text = await response.text();
    const data = JSON.parse(text);
    return data.js || [];
}

async function getStreamURL(id, token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt%20http://localhost/ch/${id}&JsHttpRequest=1-xml`;
    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) return '';
    const text = await response.text();
    const data = JSON.parse(text);
    return data.js?.cmd || '';
}

async function genToken() {
    await generateHardwareVersions();
    const token = await getToken();
    if (!token) return { token: '', profile: [], account_info: [] };
    const profile = await auth(token);
    const newToken = await handShake(token);
    if (!newToken) return { token: '', profile, account_info: [] };
    const account_info = await getAccountInfo(newToken);
    return { token: newToken, profile, account_info };
}

async function convertJsonToM3U(channels, profile, account_info, request) {
    let m3u = [
        '#EXTM3U',
        `# Total Channels => ${channels.length}`,
        ''
    ];

    const origin = new URL(request.url).origin;

    channels.forEach((channel) => {
        let cmd = channel.cmd || '';
        let real_cmd = cmd.replace('ffrt http://localhost/ch/', '');
        if (!real_cmd) {
            real_cmd = 'unknown';
        }
        const logo_url = channel.logo ? `http://${config.host}/stalker_portal/misc/logos/320/${channel.logo}` : '';
        m3u.push(`#EXTINF:-1 tvg-id="${channel.tvgid}" tvg-name="${channel.name}" tvg-logo="${logo_url}" group-title="${channel.title}",${channel.name}`);
        const channel_stream_url = `${origin}/${real_cmd}.m3u8`;
        m3u.push(channel_stream_url);
    });

    return m3u.join('\n');
}

async function handleRequest(request) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];

    const { token, profile, account_info } = await genToken();
    if (!token) return new Response('Token generation failed', { status: 500 });

    if (url.pathname === '/playlist.m3u8') {
        const channelsUrl = `http://${config.host}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
        const response = await fetch(channelsUrl, { headers: getHeaders(token) });
        if (!response.ok) return new Response(`Failed to fetch channels: ${response.status}`, { status: 500 });
        const text = await response.text();
        const channelsData = JSON.parse(text);

        const genres = await getGenres(token);

        let channels = [];
        if (channelsData.js?.data) {
            channels = channelsData.js.data.map((item) => ({
                name: item.name || 'Unknown',
                cmd: item.cmd || '',
                tvgid: item.xmltv_id || '',
                id: item.tv_genre_id || '',
                logo: item.logo || ''
            }));
        }

        const groupTitleMap = {};
        genres.forEach(group => {
            groupTitleMap[group.id] = group.title || 'Other';
        });

        channels = channels.map(channel => ({
            ...channel,
            title: groupTitleMap[channel.id] || 'Other'
        }));

        const m3uContent = await convertJsonToM3U(channels, profile, account_info, request);

        return new Response(m3uContent, {
            headers: { 'Content-Type': 'application/vnd.apple.mpegurl' }
        });
    }

    if (lastPart.endsWith('.m3u8') && lastPart !== 'playlist.m3u8') {
        const id = lastPart.replace(/\.m3u8$/, '');
        if (!id) return new Response('❌ Missing channel ID in URL', { status: 400 });

        const stream = await getStreamURL(id, token);
        if (!stream) return new Response('No stream URL received', { status: 500 });

        return Response.redirect(stream, 302);
    }

    return new Response('Not Found', { status: 404 });
}

// Cloudflare Worker export
export default {
    fetch: handleRequest
};
