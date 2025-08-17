// api/webhook.js
// Vercel serverless function: handles WhatsApp verification (GET) + messages (POST)
// Saves doctor/lab intents to Supabase and replies on WhatsApp.

import { createClient } from "@supabase/supabase-js";

// ====== ENV (set these on Vercel → Project → Settings → Environment Variables) ======
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only!
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "trihari_webhook_verify";
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v19.0";

// ====== Supabase client (server-side) ======
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ====== Your data (from your original Python) ======
const doctors = [
  {"name":"डा. किशोर कुमार पौडेल","degree":"MBBS, DMRD (CMC VELLORE)","speciality":"वरिष्ठ रेडियोलोजिष्ट","nmc":"13362","time":"प्रत्येक दिन विहान ८:०० बजे र बेलुका ४:०० बजे देखि"},
  {"name":"डा. बरुण अग्रवाल","degree":"MBBS, MD (BPKIHS)","speciality":"वरिष्ठ नवजात शिशु तथा बाल रोग विशेषज्ञ","nmc":"15375","time":"प्रत्येक दिन विहान २:३० बजे देखि"},
  {"name":"डा. शिवेस चौधरी","degree":"MBBS, MS (BPKIHS)","speciality":"वरिष्ठ स्त्री तथा प्रसूति रोग विशेषज्ञ","nmc":"16367","time":"प्रत्येक शनिवार विहान १२:०० बजे देखि"},
  {"name":"डा. दिलिप गुप्ता","degree":"MBBS (BPKIHS), MD (BPKIHS)","speciality":"वरिष्ठ फिजिसियन","nmc":"17431","time":"प्रत्येक शनिवार विहान २ बजे र मंगलवार विहान ८ बजे"},
  {"name":"डा. रितेश थपलिया","degree":"MBBS MS (BPKIHS)","speciality":"वरिष्ठ हाड जोर्नी तथा नसारोग विशेषज्ञ","nmc":"14215","time":"प्रत्येक शनिवार र मंगलवार विहान ८:०० बजे"},
  {"name":"डा. शशांकराज पोखरेल","degree":"MBBS, MD (BPKIHS)","speciality":"वरिष्ठ टाउको, नसारोग तथा मानसिक रोग विशेषज्ञ","nmc":"14450","time":"प्रत्येक शनिवार विहान १:३० बजे देखि"},
  {"name":"डा. पोषण त्रिपाठी","degree":"MBBS (IOM) MDGP (BPKIHS)","speciality":"वरिष्ठ फेमिली फिजिसियन","nmc":"4783","time":"दैनिक बेलुका ५ बजे देखि"},
  {"name":"डा. निस्तुक बराल","degree":"MBBS. MD (KU)","speciality":"वरिष्ठ छाला, कुष्ठ, यौन तथा सौन्दर्य विशेषज्ञ","nmc":"16919","time":"प्रत्येक शुक्रवार ३:०० बजे देखि"},
  {"name":"डा. शिव भूषण पण्डित","degree":"MBBS(TU), MS(KU)","speciality":"वरिष्ठ नाक, कान, घाँटी रोग विशेषज्ञ","nmc":"16947","time":"प्रत्येक शनिवार विहान २:३० बजे देखि"},
  {"name":"डा. गीरेन्द्र यादव","degree":"MBBS, BPKIHS DHARAN","speciality":"मेडिकल अफिसर","nmc":"32439","time":"२४ सै घण्टा सेवा"}
];

const lab_tests = {
  "CBC": 300,
  "Lipid Profile": 800,
  "Blood Sugar (Fasting)": 100,
  "Thyroid Function Test": 1000,
  "RFT किड्नीको जाँच (Kidney Function)": 900,
  "LFT कालेजों जाँच": 900,
  "USG Abdomen Pelvis": 1000,
  "Other Test": "Please request the test you want. Prices are based according to market."
};

// ====== Auto-reply logic ======
function autoReply(message) {
  const m = (message || "").toLowerCase();
  const isDoctor = m.includes("doctor") || m.includes("appointment") || m.includes("अप्वाइन्ट") || m.includes("डाक्टर");
  const isLab = m.includes("lab") || m.includes("test") || m.includes("जाँच") || m.includes("टेस्ट");

  if (isDoctor) {
    let reply = "📅 डाक्टरहरूको समयतालिका:\n\n";
    for (const d of doctors) {
      reply += `➡️ ${d.name}\n- ${d.speciality}\n- ${d.degree}\n- समय: ${d.time}\n- NMC: ${d.nmc}\n\n`;
    }
    reply += "कृपया कुन डाक्टरसँग appointment चाहनुहुन्छ भन्नुहोस्।";
    return reply;
  }

  if (isLab) {
    let reply = "🧪 ल्याब जाँचहरू र मूल्य:\n\n";
    for (const [test, price] of Object.entries(lab_tests)) {
      reply += typeof price === "number" ? `- ${test}: रु ${price}\n` : `- ${test}: ${price}\n`;
    }
    reply += "\nकृपया कुन test को लागि appointment चाहनुहुन्छ भन्नुहोस्।";
    return reply;
  }

  if (m.includes("hello") || m.includes("hi") || m.includes("नमस्ते")) {
    return "👋 त्रिहरी पोलिक्लिनिक र डायग्नोस्टिक सेन्टरमा स्वागत छ!\nतपाईंले डाक्टर, अप्वाइन्टमेन्ट, वा ल्याब जाँचको बारेमा सोध्न सक्नुहुन्छ।";
  }

  return "माफ गर्नुहोस्, मैले बुझिन। कृपया 'डाक्टर', 'अप्वाइन्टमेन्ट', वा 'ल्याब जाँच' को लागि सोध्नुहोस्।";
}

function guessType(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("doctor") || m.includes("appointment") || m.includes("अप्वाइन्ट") || m.includes("डाक्टर")) return "Doctor";
  if (m.includes("lab") || m.includes("test") || m.includes("जाँच") || m.includes("टेस्ट")) return "Lab Test";
  return "Other";
}

async function saveBooking({ phone, message }) {
  const type = guessType(message);
  if (type === "Other") return;

  const booking_id = `BK-${(phone || "").slice(-4)}-${Math.floor(Date.now() / 1000)}`;
  const { error } = await supabase.from("bookings").insert({
    booking_id,
    phone,
    details: (message || "").slice(0, 200),
    status: "Pending",
    type
  });
  if (error) console.error("Supabase insert error:", error);
}

async function sendWhatsAppMessage(to, text) {
  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body: text }
      })
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error("WhatsApp send error:", resp.status, body);
    }
  } catch (e) {
    console.error("WhatsApp send exception:", e);
  }
}

// ====== Vercel handler ======
export default async function handler(req, res) {
  // 1) Verification (GET)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  // 2) Webhook events (POST)
  if (req.method === "POST") {
    try {
      const data = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      console.log("Incoming:", JSON.stringify(data));

      const change = data?.entry?.[0]?.changes?.[0]?.value;
      const messages = change?.messages || [];
      const contacts = change?.contacts || [];

      if (messages.length && contacts.length) {
        const phone = contacts[0]?.wa_id;
        const msgObj = messages[0];

        // Pull message text from several possible shapes
        let userMessage = "";
        if (msgObj?.text?.body) userMessage = msgObj.text.body;
        else if (msgObj?.button?.text) userMessage = msgObj.button.text;
        else if (msgObj?.interactive?.type === "button_reply")
          userMessage = msgObj?.interactive?.button_reply?.title || msgObj?.interactive?.button_reply?.id || "";
        else if (msgObj?.interactive?.type === "list_reply")
          userMessage = msgObj?.interactive?.list_reply?.title || msgObj?.interactive?.list_reply?.id || "";

        const replyText = autoReply(userMessage);

        // Save only Doctor/Lab intents
        await saveBooking({ phone, message: userMessage });

        // Send reply back on WhatsApp
        await sendWhatsAppMessage(phone, replyText);
      }

      // Always 200 quickly
      return res.status(200).json({ status: "EVENT_RECEIVED" });
    } catch (e) {
      console.error("Webhook POST error:", e);
      return res.status(200).json({ status: "ignored" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).send("Method Not Allowed");
}
