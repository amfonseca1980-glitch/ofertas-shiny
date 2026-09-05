// Netlify Function: recebe o evento do site e envia com segurança
// pra API de Conversões da Meta, usando o token guardado como variável de ambiente.

export default async (req, context) => {
  try {
    const body = await req.json();
    const { event_name, event_id, event_source_url, fbp, fbc } = body || {};

    const pixelId = process.env.FB_PIXEL_ID;
    const accessToken = process.env.FB_ACCESS_TOKEN;

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

    const metaRes = await fetch(
      `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await metaRes.json();

    return new Response(JSON.stringify(data), {
      status: metaRes.ok ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
