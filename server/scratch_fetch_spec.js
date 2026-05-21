import fetch from "node-fetch";
import "dotenv/config";

async function run() {
  const url = process.env.SUPABASE_URL + "/rest/v1/";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const res = await fetch(url, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    });
    const spec = await res.json();
    console.log("Paths:", Object.keys(spec.paths).filter(p => p.startsWith("/rpc/")));
  } catch (err) {
    console.error(err);
  }
}
run();
