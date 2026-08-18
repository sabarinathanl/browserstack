const fs = require('fs');
const path = require('path');

const USERNAME = process.env.BROWSERSTACK_USERNAME;
const ACCESS_KEY = process.env.BROWSERSTACK_ACCESS_KEY;
const OUTPUT_DIR = path.resolve(process.cwd(), 'test-results', 'browserstack-videos');

function ensureAuth() {
  if (!USERNAME || !ACCESS_KEY) {
    throw new Error(
      'BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY environment variables are required. ' +
      'Set them before running the BrowserStack suite.'
    );
  }
}

function basicAuthHeader() {
  return 'Basic ' + Buffer.from(`${USERNAME}:${ACCESS_KEY}`).toString('base64');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BrowserStack API request failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json();
}

function slugify(value, fallback = 'value') {
  const text = String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return text || fallback;
}

function getBuildIdFromList(builds) {
  if (!Array.isArray(builds) || builds.length === 0) {
    return null;
  }

  const build = builds.sort((a, b) => {
    const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
    const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
    return timeB - timeA;
  })[0];

  return build?.hashed_id || build?.id || build?.build_id || build?._id || null;
}

function getBuildIdFromApiResponse(response) {
  if (!response) {
    return null;
  }

  if (Array.isArray(response)) {
    return getBuildIdFromList(response);
  }

  if (response.automation_build) {
    return response.automation_build.hashed_id || response.automation_build.id || response.automation_build.build_id || null;
  }

  if (Array.isArray(response.builds)) {
    return getBuildIdFromList(response.builds);
  }

  if (response.hashed_id || response.id || response.build_id) {
    return response.hashed_id || response.id || response.build_id;
  }

  return null;
}

function normalizeSessions(response) {
  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response.flatMap((item) => {
      if (!item) return [];
      if (item.automation_session) return [item.automation_session];
      if (item.session) return [item.session];
      return [item];
    });
  }

  if (Array.isArray(response.sessions)) {
    return response.sessions.flatMap((item) => {
      if (item && item.automation_session) return [item.automation_session];
      if (item && item.session) return [item.session];
      return [item];
    });
  }

  if (Array.isArray(response.automation_sessions)) {
    return response.automation_sessions;
  }

  if (response.automation_session) {
    return [response.automation_session];
  }

  if (response.session) {
    return [response.session];
  }

  if (Array.isArray(response.data)) {
    return response.data.flatMap((item) => {
      if (item && item.automation_session) return [item.automation_session];
      if (item && item.session) return [item.session];
      return [item];
    });
  }

  return [];
}

function getBuildIdFromText(text) {
  if (!text) return null;

  const patterns = [
    /build_link=.*?builds\/([A-Za-z0-9]+)/i,
    /https?:\/\/(?:automate|automation)\.browserstack\.com\/(?:dashboard\/v2\/)?builds\/([A-Za-z0-9]+)/i,
    /hashed_id=([A-Za-z0-9]+)/i,
    /build_id=([A-Za-z0-9]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function getSessionFolderName(session) {
  const browser = slugify(session.browser_name || session.browser || 'browser');
  const os = slugify(session.os || session.os_name || 'os');
  const osVersion = slugify(session.os_version || session.osVersion || 'unknown');
  const sessionId = String(session.id || session.session_id || 'session');

  return `${browser}-${os}-${osVersion}-${sessionId}`;
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(`Could not download BrowserStack video: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destinationPath, buffer);
}

async function downloadBrowserStackVideos(buildId = null, buildOutputText = '') {
  ensureAuth();

  let resolvedBuildId = buildId || getBuildIdFromText(buildOutputText);

  if (!resolvedBuildId) {
    try {
      const buildsResponse = await fetchJson('https://api.browserstack.com/automate/builds.json');
      resolvedBuildId = getBuildIdFromApiResponse(buildsResponse);
    } catch (error) {
      console.warn(`Could not resolve build from BrowserStack API list: ${error.message}`);
    }
  }

  if (!resolvedBuildId) {
    throw new Error('Could not resolve the latest BrowserStack build id. The BrowserStack CLI output did not include a build link and the BrowserStack API returned no build data.');
  }

  const sessionsResponse = await fetchJson(`https://api.browserstack.com/automate/builds/${resolvedBuildId}/sessions.json`);
  const sessions = normalizeSessions(sessionsResponse);

  if (!Array.isArray(sessions) || sessions.length === 0) {
    console.warn(`No BrowserStack sessions were found for build ${resolvedBuildId}.`);
    return { buildId: resolvedBuildId, downloaded: 0, sessions: [] };
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const downloaded = [];

  for (const session of sessions) {
    const normalizedSession = session && session.automation_session ? session.automation_session : session;
    const videoUrl = normalizedSession.video_url || normalizedSession.videoUrl || normalizedSession.video || null;

    if (!videoUrl) {
      continue;
    }

    const folderName = getSessionFolderName(normalizedSession);
    const sessionFolder = path.join(OUTPUT_DIR, folderName);
    fs.mkdirSync(sessionFolder, { recursive: true });

    const fileName = `video-${slugify(session.status || 'completed')}.mp4`;
    const outputPath = path.join(sessionFolder, fileName);

    try {
      await downloadFile(videoUrl, outputPath);
      downloaded.push({
        sessionId: normalizedSession.id || normalizedSession.session_id,
        folder: sessionFolder,
        file: outputPath,
      });
      console.log(`Downloaded BrowserStack video to ${outputPath}`);
    } catch (error) {
      console.error(`Failed to download BrowserStack video for session ${normalizedSession.id || normalizedSession.session_id}: ${error.message}`);
    }
  }

  if (downloaded.length === 0) {
    console.warn(`No BrowserStack session videos were downloaded for build ${resolvedBuildId}.`);
  }

  return { buildId: resolvedBuildId, downloaded: downloaded.length, sessions: downloaded };
}

if (require.main === module) {
  const buildIdArg = process.argv[2];

  downloadBrowserStackVideos(buildIdArg)
    .then((result) => {
      console.log(`BrowserStack video download complete. Downloaded ${result.downloaded} video(s).`);
    })
    .catch((error) => {
      console.error('BrowserStack video download failed:');
      console.error(error.message);
      process.exitCode = 0;
    });
}

module.exports = { downloadBrowserStackVideos, getBuildIdFromList };
