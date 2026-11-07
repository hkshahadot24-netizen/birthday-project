const MAX_BYTES = 8 * 1024 * 1024;
const MIME_EXT = new Map([
  ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"], ["image/gif", ".gif"], ["image/avif", ".avif"],
  ["audio/mpeg", ".mp3"], ["audio/mp4", ".m4a"], ["audio/wav", ".wav"], ["audio/ogg", ".ogg"], ["audio/webm", ".webm"],
  ["application/pdf", ".pdf"], ["text/plain", ".txt"], ["text/csv", ".csv"], ["application/zip", ".zip"],
  ["application/msword", ".doc"], ["application/vnd.ms-excel", ".xls"], ["application/vnd.ms-powerpoint", ".ppt"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"],
  ["video/mp4", ".mp4"], ["video/webm", ".webm"], ["video/quicktime", ".mov"]
]);
let jwksCache = { expires: 0, keys: [] };

function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}
function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
  return allowed.includes(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "Authorization, Content-Type", "access-control-max-age": "86400", "vary": "Origin" } : {};
}
function decodeB64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function decodeJsonPart(value) { return JSON.parse(new TextDecoder().decode(decodeB64Url(value))); }
async function verifyFirebaseToken(token, projectId) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid bearer token.");
  const header = decodeJsonPart(parts[0]), claims = decodeJsonPart(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported token signature.");
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Token belongs to another Firebase project.");
  if (!claims.sub || claims.sub.length > 128 || claims.exp <= now || claims.iat > now + 60) throw new Error("Token is expired or invalid.");
  if (jwksCache.expires < Date.now()) {
    const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    if (!response.ok) throw new Error("Could not verify Firebase identity.");
    const data = await response.json(); jwksCache = { keys: data.keys || [], expires: Date.now() + 50 * 60 * 1000 };
  }
  const jwk = jwksCache.keys.find(k => k.kid === header.kid);
  if (!jwk) { jwksCache.expires = 0; throw new Error("Unknown signing key. Please retry."); }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeB64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error("Firebase token signature is invalid.");
  return claims;
}
const BLOCKED_EXT = new Set([".html", ".htm", ".xhtml", ".js", ".mjs", ".cjs", ".svg", ".xml", ".exe", ".dll", ".com", ".msi", ".bat", ".cmd", ".sh", ".ps1", ".php", ".py", ".wasm", ".jar", ".apk"]);
function cleanName(name) {
  return String(name || "upload").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "upload";
}
function toBase64(bytes) {
  let binary = ""; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: cors["access-control-allow-origin"] ? 204 : 403, headers: cors });
    if (!cors["access-control-allow-origin"]) return json({ error: "Origin not allowed." }, 403);
    if (request.method !== "POST" || new URL(request.url).pathname !== "/upload") return json({ error: "Not found." }, 404, cors);
    try {
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ error: "Sign in is required." }, 401, cors);
      const claims = await verifyFirebaseToken(auth.slice(7), env.FIREBASE_PROJECT_ID);
      const form = await request.formData();
      const file = form.get("file"), category = String(form.get("category") || "");
      if (!(file instanceof File)) return json({ error: "Choose a file first." }, 400, cors);
      if (file.size < 1 || file.size > MAX_BYTES) return json({ error: "File must be between 1 byte and 8 MB." }, 413, cors);
      const expected = file.type.startsWith("image/") ? "Images" : file.type.startsWith("audio/") ? "Audio" : "Files";
      if (category !== expected) return json({ error: `Choose ${expected} for this file type.` }, 400, cors);
      const originalExt = (String(file.name).match(/\.[a-z0-9]{1,10}$/i) || [""])[0].toLowerCase();
      const ext = MIME_EXT.get(file.type) || (category === "Files" && originalExt && !BLOCKED_EXT.has(originalExt) ? originalExt : null);
      if (!ext || BLOCKED_EXT.has(ext)) return json({ error: "This file type is not allowed for safe public hosting." }, 415, cors);
      let base = cleanName(file.name).replace(/\.[^.]+$/, "");
      const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const path = `Assets/${category}/${claims.sub}/${unique}-${base}${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
      const gh = await fetch(apiUrl, {
        method: "PUT",
        headers: { "authorization": `Bearer ${env.GITHUB_TOKEN}`, "accept": "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28", "user-agent": "Birthday-Celebration-Asset-Uploader" },
        body: JSON.stringify({ message: `Upload ${category.toLowerCase()} asset for ${claims.sub}`, branch: env.GITHUB_BRANCH || "main", content: toBase64(bytes) })
      });
      const result = await gh.json();
      if (!gh.ok) return json({ error: result.message || "GitHub upload failed." }, gh.status === 401 || gh.status === 403 ? 502 : 502, cors);
      const rawUrl = result.content?.download_url || `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH || "main"}/${path}`;
      return json({ ok: true, path, url: rawUrl, name: file.name, size: file.size, contentType: file.type, sha: result.content?.sha || null }, 200, cors);
    } catch (error) {
      return json({ error: error.message || "Upload failed." }, 400, cors);
    }
  }
};
