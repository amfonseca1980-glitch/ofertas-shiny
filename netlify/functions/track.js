// Netlify Function: recebe o evento do site e envia com segurança
// pra API de Conversões da Meta, usando o token guardado como variável de ambiente.

// Pixel novo (campanha PokeInfoShiny) — só este evento é duplicado pra ele.
const POKE_PIXEL_ID = "4654332701455111";
const POKE_EVENT_NAME = "Lead_PokeInfoShiny";

async function sendToMeta(pixelId, accessToken, payload) {
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default async (req, context) => {
  try {
    const body = await req.json();
    const { event_name, event_id, event_source_url, fbp, fbc } = body || {};

    const pixelId = process.env.FB_PIXEL_ID;
    const accessToken = process.env.FB_ACCESS_TOKEN;
    const pokeAccessToken = process.env.FB_ACCESS_TOKEN_POKE;

    if (!pixelId || !accessToken) {
      return new Response(
        JSON.stringify({ error: "Faltam variáveis de ambiente no Netlify (FB_PIXEL_ID / FB_ACCESS_TOKEN)" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const clientIp =
      req.headers.get("x-nf-client-connection-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = req.headers.get("user-agent");

    const payload = {
      data: [
        {
          event_name: event_name || "Lead",
          event_time: Math.floor(Date.now() / 1000),
          event_id,
          event_source_url,
          action_source: "website",
          user_data: {
            client_ip_address: clientIp,
            client_user_agent: userAgent,
            ...(fbp ? { fbp } : {}),
            ...(fbc ? { fbc } : {}),
          },
        },
      ],
    };

    // Sempre manda pro Pixel antigo (comportamento original, sem mudança)
    const mainResult = await sendToMeta(pixelId, accessToken, payload);

    // Se for o evento do PokeInfoShiny e o token do Pixel novo estiver configurado,
    // manda também uma segunda cópia pro Pixel novo da campanha.
    let pokeResult = null;
    if (event_name === POKE_EVENT_NAME && pokeAccessToken) {
      pokeResult = await sendToMeta(POKE_PIXEL_ID, pokeAccessToken, payload).catch((err) => ({
        ok: false,
        error: err.message,
      }));
    }

    return new Response(
      JSON.stringify({ main: mainResult.data, poke: pokeResult }),
      {
        status: mainResult.ok ? 200 : 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
