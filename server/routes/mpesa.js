import axios from "axios";

export async function getMpesaToken() {
  const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  
  const auth = Buffer.from(
    process.env.MPESA_CONSUMER_KEY + ":" + process.env.MPESA_CONSUMER_SECRET
  ).toString("base64");

  const { data } = await axios.get(url, {
    headers: { Authorization: "Basic " + auth },
  });

  return data.access_token;
}
