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
  if (parts.length !== 3) throw new Error("লগইন টোকেন সঠিক নয়।");
  const header = decodeJsonPart(parts[0]), claims = decodeJsonPart(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || !header.kid) throw new Error("লগইন টোকেনের স্বাক্ষর সমর্থিত নয়।");
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("লগইন টোকেনটি অন্য Firebase প্রজেক্টের।");
  if (!claims.sub || claims.sub.length > 128 || claims.exp <= now || claims.iat > now + 60) throw new Error("লগইন টোকেনের মেয়াদ শেষ অথবা টোকেনটি সঠিক নয়।");
  if (jwksCache.expires < Date.now()) {
    const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    if (!response.ok) throw new Error("Firebase পরিচয় যাচাই করা যায়নি।");
    const data = await response.json(); jwksCache = { keys: data.keys || [], expires: Date.now() + 50 * 60 * 1000 };
  }
  const jwk = jwksCache.keys.find(k => k.kid === header.kid);
  if (!jwk) { jwksCache.expires = 0; throw new Error("যাচাইকরণ কী পাওয়া যায়নি। আবার চেষ্টা করুন।"); }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeB64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error("Firebase লগইন টোকেনের স্বাক্ষর সঠিক নয়।");
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
    if (!cors["access-control-allow-origin"]) return json({ error: "এই ওয়েবসাইট থেকে আপলোডের অনুমতি নেই। Worker-এর ALLOWED_ORIGINS সেটিংসে ওয়েবসাইটের Origin যোগ করুন।" }, 403);
    if (request.method !== "POST" || new URL(request.url).pathname !== "/upload") return json({ error: "আপলোড ঠিকানা পাওয়া যায়নি। Worker URL এবং /upload পথ পরীক্ষা করুন।" }, 404, cors);
    try {
      if (!env.GITHUB_TOKEN) return json({ error: "Cloudflare Worker-এ GITHUB_TOKEN Secret সেট করা হয়নি।" }, 500, cors);
      if (!env.GITHUB_OWNER || !env.GITHUB_REPO || !env.FIREBASE_PROJECT_ID) return json({ error: "Worker-এর GITHUB_OWNER, GITHUB_REPO অথবা FIREBASE_PROJECT_ID সেটিংস অসম্পূর্ণ।" }, 500, cors);
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ error: "আপলোডের আগে Google অ্যাকাউন্ট দিয়ে প্রবেশ করুন। প্রয়োজনে আবার লগইন করুন।" }, 401, cors);
      const claims = await verifyFirebaseToken(auth.slice(7), env.FIREBASE_PROJECT_ID);
      const form = await request.formData();
      const file = form.get("file"), category = String(form.get("category") || "");
      if (!(file instanceof File)) return json({ error: "প্রথমে একটি ফাইল নির্বাচন করুন।" }, 400, cors);
      if (file.size < 1 || file.size > MAX_BYTES) return json({ error: "ফাইলের আকার ১ বাইট থেকে ৮ MB-এর মধ্যে হতে হবে।" }, 413, cors);
      const expected = file.type.startsWith("image/") ? "Images" : file.type.startsWith("audio/") ? "Audio" : "Files";
      if (category !== expected) return json({ error: `এই ফাইলের জন্য ${expected} বিভাগ নির্বাচন করুন।` }, 400, cors);
      const originalExt = (String(file.name).match(/\.[a-z0-9]{1,10}$/i) || [""])[0].toLowerCase();
      const ext = MIME_EXT.get(file.type) || (category === "Files" && originalExt && !BLOCKED_EXT.has(originalExt) ? originalExt : null);
      if (!ext || BLOCKED_EXT.has(ext)) return json({ error: "নিরাপদ পাবলিক হোস্টিংয়ের জন্য এই ফাইলের ধরন অনুমোদিত নয়।" }, 415, cors);
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
      let result = {};
      try { result = await gh.json(); } catch (_) {}
      if (!gh.ok) {
        const detail = Array.isArray(result.errors) ? result.errors.map(x => x.message || x.code || JSON.stringify(x)).join("; ") : "";
        const reason = result.message || "GitHub-এ ফাইল আপলোড করা যায়নি।";
        const hint = gh.status === 401 ? " GITHUB_TOKEN সঠিক আছে এবং মেয়াদ শেষ হয়নি কি না পরীক্ষা করুন।"
          : gh.status === 403 ? " GitHub Token-এ এই রিপোজিটরির প্রবেশাধিকার এবং Contents: Read and write অনুমতি দিন; GitHub rate limit-ও পরীক্ষা করুন।"
          : gh.status === 404 ? " GITHUB_OWNER, GITHUB_REPO ও GITHUB_BRANCH পরীক্ষা করুন।"
          : gh.status === 422 ? " GitHub ফাইল বা পথটি গ্রহণ করেনি। ফাইলের নাম পরিবর্তন করে আবার চেষ্টা করুন।"
          : "";
        return json({ error: `${reason}${detail ? " — " + detail : ""}${hint}`, githubStatus: gh.status }, 502, cors);
      }
      const rawUrl = result.content?.download_url || `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH || "main"}/${path}`;
      return json({ ok: true, path, url: rawUrl, name: file.name, size: file.size, contentType: file.type, sha: result.content?.sha || null }, 200, cors);
    } catch (error) {
      return json({ error: error.message || "Upload failed." }, 400, cors);
    }
  }
};
